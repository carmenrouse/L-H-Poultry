const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('minimum_wage');
  res.json({ minimum_wage: Number(row.value) });
});

router.put('/', requireRole('admin'), (req, res) => {
  const { minimum_wage } = req.body;
  if (minimum_wage === undefined || Number(minimum_wage) < 0) {
    return res.status(400).json({ error: 'minimum_wage must be a non-negative number' });
  }
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(minimum_wage), 'minimum_wage');
  res.json({ minimum_wage: Number(minimum_wage) });
});

module.exports = router;
