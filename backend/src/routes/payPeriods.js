const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculatePayPeriod, round2 } = require('../services/payCalc');
const { toCsv } = require('../utils/csv');

const router = express.Router();

router.use(requireAuth);

function taskPayTotalForRange(employeeId, startDate, endDate) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(rate), 0) AS total FROM tasks
       WHERE assigned_to = ? AND status = 'approved'
       AND date(approved_at) BETWEEN date(?) AND date(?)`
    )
    .get(employeeId, startDate, endDate);
  return round2(row.total);
}

function currentMinimumWage() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('minimum_wage');
  return Number(row.value);
}

function scopeToOwnIfEmployee(req, res, period) {
  if (req.user.role === 'employee' && period.employee_id !== req.user.id) {
    res.status(403).json({ error: 'Not your pay period' });
    return false;
  }
  return true;
}

router.get('/', (req, res) => {
  const { employee_id } = req.query;
  const clauses = [];
  const params = [];
  if (req.user.role === 'employee') {
    clauses.push('employee_id = ?');
    params.push(req.user.id);
  } else if (employee_id) {
    clauses.push('employee_id = ?');
    params.push(employee_id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM pay_periods ${where} ORDER BY start_date DESC, id DESC`)
    .all(...params);
  res.json({ pay_periods: rows });
});

// Employee's own live running total for the current, still-open stretch of
// approved task pay since their last closed pay period ended.
router.get('/current-total', requireRole('employee'), (req, res) => {
  const lastClosed = db
    .prepare(
      `SELECT * FROM pay_periods WHERE employee_id = ? AND status = 'closed'
       ORDER BY end_date DESC LIMIT 1`
    )
    .get(req.user.id);
  const since = lastClosed ? lastClosed.end_date : '1970-01-01';
  const today = new Date().toISOString().slice(0, 10);
  const total = taskPayTotalForRange(req.user.id, since, today);
  res.json({ since, through: today, task_pay_total: total });
});

router.get('/export.csv', requireRole('admin'), (req, res) => {
  const { employee_id } = req.query;
  const clauses = ["status = 'closed'"];
  const params = [];
  if (employee_id) {
    clauses.push('employee_id = ?');
    params.push(employee_id);
  }
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS employee_name FROM pay_periods p
       JOIN users u ON u.id = p.employee_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY p.start_date DESC`
    )
    .all(...params);

  const csv = toCsv(rows, [
    { key: 'id', label: 'Pay Period ID' },
    { key: 'employee_name', label: 'Employee' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'hours_worked', label: 'Hours Worked' },
    { key: 'task_pay_total', label: 'Task Pay Total' },
    { key: 'effective_hourly', label: 'Effective Hourly' },
    { key: 'minimum_wage_used', label: 'Minimum Wage Used' },
    { key: 'topup_amount', label: 'Topup Amount' },
    { key: 'final_pay', label: 'Final Pay' },
    { key: 'closed_at', label: 'Closed At' },
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pay_periods.csv"');
  res.send(csv);
});

router.get('/:id', (req, res) => {
  const period = db.prepare('SELECT * FROM pay_periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Pay period not found' });
  if (!scopeToOwnIfEmployee(req, res, period)) return;

  if (period.status === 'open') {
    period.task_pay_total = taskPayTotalForRange(period.employee_id, period.start_date, period.end_date);
  }
  res.json({ pay_period: period });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { employee_id, start_date, end_date } = req.body;
  if (!employee_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'employee_id, start_date, end_date are required' });
  }
  if (start_date > end_date) {
    return res.status(400).json({ error: 'start_date must be on or before end_date' });
  }
  const employee = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(employee_id);
  if (!employee) return res.status(400).json({ error: 'employee_id must be an active user' });

  const info = db
    .prepare(`INSERT INTO pay_periods (employee_id, start_date, end_date) VALUES (?, ?, ?)`)
    .run(employee_id, start_date, end_date);
  const period = db.prepare('SELECT * FROM pay_periods WHERE id = ?').get(info.lastInsertRowid);
  period.task_pay_total = taskPayTotalForRange(employee_id, start_date, end_date);
  res.status(201).json({ pay_period: period });
});

// The core guardrail: a closed pay period is a locked historical record.
// Rate/pay_type changes never retroactively touch it because it isn't
// recomputed from live data - closing snapshots task_pay_total, the minimum
// wage in effect, and the topup right now, once, forever.
router.post('/:id/close', requireRole('admin'), (req, res) => {
  const period = db.prepare('SELECT * FROM pay_periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Pay period not found' });
  if (period.status === 'closed') {
    return res.status(409).json({ error: 'This pay period is already closed and cannot be edited' });
  }

  const hoursWorked = Number(req.body.hours_worked);
  if (Number.isNaN(hoursWorked) || hoursWorked < 0) {
    return res.status(400).json({ error: 'hours_worked must be a non-negative number' });
  }

  const taskPayTotal = taskPayTotalForRange(period.employee_id, period.start_date, period.end_date);
  const minimumWage = currentMinimumWage();
  const { effectiveHourly, topupAmount, finalPay } = calculatePayPeriod({
    taskPayTotal,
    hoursWorked,
    minimumWage,
  });

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE pay_periods SET hours_worked = ?, task_pay_total = ?, effective_hourly = ?,
     minimum_wage_used = ?, topup_amount = ?, final_pay = ?, status = 'closed', closed_at = ?
     WHERE id = ?`
  ).run(hoursWorked, taskPayTotal, effectiveHourly, minimumWage, topupAmount, finalPay, now, period.id);

  const updated = db.prepare('SELECT * FROM pay_periods WHERE id = ?').get(period.id);
  res.json({ pay_period: updated });
});

// Deliberately no general PATCH/DELETE on pay periods: once created, only
// close() may write to a period, and close() itself refuses to run twice.
// This is what makes "never allow a closed pay period to change" true by
// construction rather than by convention.

module.exports = router;
