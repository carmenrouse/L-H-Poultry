const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { toCsv } = require('../utils/csv');

const router = express.Router();

router.use(requireAuth);

function getAttempts(taskId) {
  return db
    .prepare('SELECT * FROM task_attempts WHERE task_id = ? ORDER BY attempt_number')
    .all(taskId);
}

function scopeToOwnTasksIfEmployee(req, res, task) {
  if (req.user.role === 'employee' && task.assigned_to !== req.user.id) {
    res.status(403).json({ error: 'Not your task' });
    return false;
  }
  return true;
}

// List tasks. Employees only ever see their own; admins can filter.
router.get('/', (req, res) => {
  const { date, assigned_to, status } = req.query;
  const clauses = [];
  const params = [];

  if (req.user.role === 'employee') {
    clauses.push('assigned_to = ?');
    params.push(req.user.id);
  } else if (assigned_to) {
    clauses.push('assigned_to = ?');
    params.push(assigned_to);
  }

  if (date) {
    clauses.push('assigned_date = ?');
    params.push(date);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM tasks ${where} ORDER BY assigned_date DESC, id DESC`)
    .all(...params);
  res.json({ tasks: rows });
});

router.get('/export.csv', requireRole('admin'), (req, res) => {
  const { assigned_to, start, end } = req.query;
  const clauses = [];
  const params = [];
  if (assigned_to) {
    clauses.push('t.assigned_to = ?');
    params.push(assigned_to);
  }
  if (start) {
    clauses.push('t.assigned_date >= ?');
    params.push(start);
  }
  if (end) {
    clauses.push('t.assigned_date <= ?');
    params.push(end);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT t.id, u.name AS employee_name, t.title, t.assigned_date, t.rate, t.status,
              t.attempt_count, t.opened_at, t.completed_at, t.approved_at
       FROM tasks t JOIN users u ON u.id = t.assigned_to
       ${where}
       ORDER BY t.assigned_date DESC, t.id DESC`
    )
    .all(...params);

  const csv = toCsv(rows, [
    { key: 'id', label: 'Task ID' },
    { key: 'employee_name', label: 'Employee' },
    { key: 'title', label: 'Task' },
    { key: 'assigned_date', label: 'Assigned Date' },
    { key: 'rate', label: 'Rate' },
    { key: 'status', label: 'Status' },
    { key: 'attempt_count', label: 'Attempts' },
    { key: 'opened_at', label: 'Opened At' },
    { key: 'completed_at', label: 'Completed At' },
    { key: 'approved_at', label: 'Approved At' },
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="task_history.csv"');
  res.send(csv);
});

router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!scopeToOwnTasksIfEmployee(req, res, task)) return;
  res.json({ task, attempts: getAttempts(task.id) });
});

// Admin assigns a task: from a template (rate/requires_photo copied at
// assignment time) or as a one-off with a manually set rate. Either way the
// rate is frozen on the task row from this point on.
router.post('/', requireRole('admin'), (req, res) => {
  const { template_id, assigned_to, assigned_date, title, description, rate, requires_photo } = req.body;

  if (!assigned_to || !assigned_date) {
    return res.status(400).json({ error: 'assigned_to and assigned_date are required' });
  }
  const employee = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(assigned_to);
  if (!employee) return res.status(400).json({ error: 'assigned_to must be an active user' });

  let finalTitle = title;
  let finalDescription = description;
  let finalRate = rate;
  let finalRequiresPhoto = requires_photo;

  if (template_id) {
    const template = db.prepare('SELECT * FROM task_templates WHERE id = ? AND active = 1').get(template_id);
    if (!template) return res.status(400).json({ error: 'template_id not found' });
    finalTitle = finalTitle || template.title;
    finalDescription = finalDescription !== undefined ? finalDescription : template.description;
    finalRate = finalRate !== undefined && finalRate !== null ? finalRate : template.default_rate;
    finalRequiresPhoto = finalRequiresPhoto !== undefined ? finalRequiresPhoto : template.requires_photo;
  }

  if (!finalTitle || finalRate === undefined || finalRate === null) {
    return res.status(400).json({ error: 'title and rate are required (directly or via template_id)' });
  }
  if (Number(finalRate) < 0) {
    return res.status(400).json({ error: 'rate cannot be negative' });
  }

  const insert = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO tasks (template_id, assigned_to, assigned_date, title, description, rate, requires_photo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        template_id || null,
        assigned_to,
        assigned_date,
        finalTitle,
        finalDescription || null,
        finalRate,
        finalRequiresPhoto ? 1 : 0
      );
    db.prepare('INSERT INTO task_attempts (task_id, attempt_number) VALUES (?, 1)').run(info.lastInsertRowid);
    return info.lastInsertRowid;
  });

  const taskId = insert();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json({ task, attempts: getAttempts(taskId) });
});

// Admin can edit a not-yet-approved task's rate/details. Once approved the
// rate is part of an immutable historical record - see the reject/approve
// handlers below - editing is refused entirely.
router.patch('/:id', requireRole('admin'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status === 'approved') {
    return res.status(409).json({ error: 'Cannot edit an approved task; its rate is locked in for pay' });
  }

  const { title, description, rate, requires_photo } = req.body;
  if (rate !== undefined && Number(rate) < 0) {
    return res.status(400).json({ error: 'rate cannot be negative' });
  }

  const next = {
    title: title ?? task.title,
    description: description !== undefined ? description : task.description,
    rate: rate ?? task.rate,
    requires_photo: requires_photo !== undefined ? (requires_photo ? 1 : 0) : task.requires_photo,
  };

  db.prepare('UPDATE tasks SET title = ?, description = ?, rate = ?, requires_photo = ? WHERE id = ?').run(
    next.title,
    next.description,
    next.rate,
    next.requires_photo,
    task.id
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated });
});

// Employee opens a task: logs opened_at as a read receipt.
router.post('/:id/open', requireRole('employee'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!scopeToOwnTasksIfEmployee(req, res, task)) return;
  if (!['assigned', 'opened'].includes(task.status)) {
    return res.status(409).json({ error: `Cannot open a task with status ${task.status}` });
  }

  const now = new Date().toISOString();
  const updateTask = task.status === 'assigned';

  db.transaction(() => {
    if (updateTask) {
      db.prepare('UPDATE tasks SET status = ?, opened_at = ? WHERE id = ?').run('opened', now, task.id);
    }
    db.prepare(
      `UPDATE task_attempts SET started_at = COALESCE(started_at, ?)
       WHERE task_id = ? AND attempt_number = ?`
    ).run(now, task.id, task.attempt_count);
  })();

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated, attempts: getAttempts(task.id) });
});

// Employee marks a task complete: optional/required photo + note, awaiting approval.
router.post('/:id/complete', requireRole('employee'), upload.single('photo'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!scopeToOwnTasksIfEmployee(req, res, task)) return;
  if (!['assigned', 'opened'].includes(task.status)) {
    return res.status(409).json({ error: `Cannot complete a task with status ${task.status}` });
  }
  if (task.requires_photo && !req.file) {
    return res.status(400).json({ error: 'A photo is required to complete this task' });
  }

  const now = new Date().toISOString();
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const employeeNote = req.body.employee_note || null;

  db.transaction(() => {
    db.prepare(
      `UPDATE tasks SET status = 'completed', opened_at = COALESCE(opened_at, ?), completed_at = ?,
       photo_url = ?, employee_note = ? WHERE id = ?`
    ).run(now, now, photoUrl, employeeNote, task.id);
    db.prepare(
      `UPDATE task_attempts SET started_at = COALESCE(started_at, ?), ended_at = ?, photo_url = ?
       WHERE task_id = ? AND attempt_number = ?`
    ).run(now, now, photoUrl, task.id, task.attempt_count);
  })();

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated, attempts: getAttempts(task.id) });
});

// Admin approves: pay is granted exactly once here, regardless of how many
// prior rejected attempts this task went through. The rate never changes.
router.post('/:id/approve', requireRole('admin'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== 'completed') {
    return res.status(409).json({ error: 'Only a completed task can be approved' });
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`UPDATE tasks SET status = 'approved', approved_at = ? WHERE id = ?`).run(now, task.id);
    db.prepare(
      `UPDATE task_attempts SET outcome = 'approved', ended_at = COALESCE(ended_at, ?)
       WHERE task_id = ? AND attempt_number = ?`
    ).run(now, task.id, task.attempt_count);
  })();

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated, attempts: getAttempts(task.id) });
});

// Admin rejects: task reopens with a required note, attempt_count increments,
// and a brand-new TaskAttempt row is created for the next try. Nothing about
// the task's rate changes - rejection just withholds pay, it never deducts it.
router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== 'completed') {
    return res.status(409).json({ error: 'Only a completed task can be rejected' });
  }
  const note = (req.body.supervisor_note || '').trim();
  if (!note) return res.status(400).json({ error: 'supervisor_note is required to reject a task' });

  const now = new Date().toISOString();
  const nextAttemptNumber = task.attempt_count + 1;

  db.transaction(() => {
    db.prepare(
      `UPDATE task_attempts SET outcome = 'rejected', note = ?, ended_at = COALESCE(ended_at, ?)
       WHERE task_id = ? AND attempt_number = ?`
    ).run(note, now, task.id, task.attempt_count);

    db.prepare('INSERT INTO task_attempts (task_id, attempt_number) VALUES (?, ?)').run(
      task.id,
      nextAttemptNumber
    );

    db.prepare(
      `UPDATE tasks SET status = 'assigned', opened_at = NULL, completed_at = NULL, photo_url = NULL,
       employee_note = NULL, supervisor_note = ?, attempt_count = ? WHERE id = ?`
    ).run(note, nextAttemptNumber, task.id);
  })();

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: updated, attempts: getAttempts(task.id) });
});

module.exports = router;
