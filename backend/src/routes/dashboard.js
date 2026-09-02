const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { round2 } = require('../services/payCalc');

const router = express.Router();

router.use(requireAuth);

function employeeStats(employeeId) {
  const approvedTasks = db
    .prepare(`SELECT * FROM tasks WHERE assigned_to = ? AND status = 'approved'`)
    .all(employeeId);

  const approvedCount = approvedTasks.length;
  const firstAttemptApprovals = approvedTasks.filter((t) => t.attempt_count === 1).length;
  const approvalRateFirstAttempt = approvedCount ? round2((firstAttemptApprovals / approvedCount) * 100) : null;
  const avgAttemptsPerTask = approvedCount
    ? round2(approvedTasks.reduce((sum, t) => sum + t.attempt_count, 0) / approvedCount)
    : null;

  const trend = db
    .prepare(
      `SELECT id, start_date, end_date, effective_hourly, final_pay, hours_worked, topup_amount
       FROM pay_periods WHERE employee_id = ? AND status = 'closed' ORDER BY start_date`
    )
    .all(employeeId);

  const byTemplate = new Map();
  for (const t of approvedTasks) {
    const key = t.title;
    if (!byTemplate.has(key)) byTemplate.set(key, { title: key, taskCount: 0, totalAttempts: 0 });
    const entry = byTemplate.get(key);
    entry.taskCount += 1;
    entry.totalAttempts += t.attempt_count;
  }
  const redoHeavyTaskTypes = Array.from(byTemplate.values())
    .map((e) => ({ title: e.title, taskCount: e.taskCount, avgAttempts: round2(e.totalAttempts / e.taskCount) }))
    .filter((e) => e.avgAttempts > 1)
    .sort((a, b) => b.avgAttempts - a.avgAttempts)
    .slice(0, 10);

  return {
    approvedTaskCount: approvedCount,
    approvalRateFirstAttempt,
    avgAttemptsPerTask,
    effectiveHourlyTrend: trend,
    redoHeavyTaskTypes,
  };
}

router.get('/employees/:id/stats', (req, res) => {
  const employeeId = Number(req.params.id);
  if (req.user.role === 'employee' && req.user.id !== employeeId) {
    return res.status(403).json({ error: 'Not your stats' });
  }
  const employee = db.prepare('SELECT id, name, pay_type FROM users WHERE id = ?').get(employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  res.json({ employee, stats: employeeStats(employeeId) });
});

router.get('/overview', requireRole('admin'), (req, res) => {
  const employees = db
    .prepare(`SELECT id, name, pay_type FROM users WHERE role = 'employee' AND active = 1 ORDER BY name`)
    .all();

  const overview = employees.map((employee) => {
    const stats = employeeStats(employee.id);
    const latestTrend = stats.effectiveHourlyTrend[stats.effectiveHourlyTrend.length - 1];
    return {
      employee,
      approvalRateFirstAttempt: stats.approvalRateFirstAttempt,
      avgAttemptsPerTask: stats.avgAttemptsPerTask,
      latestEffectiveHourly: latestTrend ? latestTrend.effective_hourly : null,
      redoHeavyTaskTypes: stats.redoHeavyTaskTypes.slice(0, 3),
    };
  });

  const pendingReview = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'completed'`).get().n;

  res.json({ overview, pendingReview });
});

module.exports = router;
