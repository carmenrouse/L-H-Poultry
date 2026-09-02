const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

router.use(requireAuth);

// Admin: list all employees. Employees can list active users too (for display), but
// only admin can see inactive/full detail.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY name').all();
  res.json({ users: rows.map(publicUser) });
});

router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, username, role, pay_type, hourly_rate, password } = req.body;
  if (!name || !username || !role || !pay_type || !password) {
    return res.status(400).json({ error: 'name, username, role, pay_type, password are required' });
  }
  if (!['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or employee' });
  }
  if (!['hourly', 'piece_rate'].includes(pay_type)) {
    return res.status(400).json({ error: 'pay_type must be hourly or piece_rate' });
  }
  if (pay_type === 'hourly' && (hourly_rate === undefined || hourly_rate === null)) {
    return res.status(400).json({ error: 'hourly_rate is required for hourly pay_type' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'username already in use' });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (name, username, role, pay_type, hourly_rate, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, username, role, pay_type, pay_type === 'hourly' ? hourly_rate : null, password_hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

// Pay type / rate changes only ever affect future pay periods: this endpoint
// edits the live user record, never a closed PayPeriod snapshot (those are
// immutable once closed - see payPeriods.js).
router.patch('/:id', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, pay_type, hourly_rate, active, password } = req.body;
  const next = {
    name: name ?? user.name,
    pay_type: pay_type ?? user.pay_type,
    hourly_rate: hourly_rate !== undefined ? hourly_rate : user.hourly_rate,
    active: active !== undefined ? (active ? 1 : 0) : user.active,
  };
  if (!['hourly', 'piece_rate'].includes(next.pay_type)) {
    return res.status(400).json({ error: 'pay_type must be hourly or piece_rate' });
  }
  if (next.pay_type === 'hourly' && (next.hourly_rate === null || next.hourly_rate === undefined)) {
    return res.status(400).json({ error: 'hourly_rate is required for hourly pay_type' });
  }
  if (next.pay_type === 'piece_rate') {
    next.hourly_rate = null;
  }

  db.prepare(
    `UPDATE users SET name = ?, pay_type = ?, hourly_rate = ?, active = ? WHERE id = ?`
  ).run(next.name, next.pay_type, next.hourly_rate, next.active, user.id);

  if (password) {
    const password_hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: publicUser(updated) });
});

module.exports = router;
