const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM task_templates WHERE active = 1 ORDER BY title').all();
  res.json({ templates: rows });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { title, description, default_rate, requires_photo } = req.body;
  if (!title || default_rate === undefined || default_rate === null) {
    return res.status(400).json({ error: 'title and default_rate are required' });
  }
  if (Number(default_rate) < 0) {
    return res.status(400).json({ error: 'default_rate cannot be negative' });
  }

  const info = db
    .prepare(
      `INSERT INTO task_templates (title, description, default_rate, requires_photo)
       VALUES (?, ?, ?, ?)`
    )
    .run(title, description || null, default_rate, requires_photo ? 1 : 0);

  const template = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ template });
});

router.patch('/:id', requireRole('admin'), (req, res) => {
  const template = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { title, description, default_rate, requires_photo, active } = req.body;
  if (default_rate !== undefined && Number(default_rate) < 0) {
    return res.status(400).json({ error: 'default_rate cannot be negative' });
  }

  const next = {
    title: title ?? template.title,
    description: description !== undefined ? description : template.description,
    default_rate: default_rate ?? template.default_rate,
    requires_photo: requires_photo !== undefined ? (requires_photo ? 1 : 0) : template.requires_photo,
    active: active !== undefined ? (active ? 1 : 0) : template.active,
  };

  db.prepare(
    `UPDATE task_templates SET title = ?, description = ?, default_rate = ?, requires_photo = ?, active = ?
     WHERE id = ?`
  ).run(next.title, next.description, next.default_rate, next.requires_photo, next.active, template.id);

  const updated = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(template.id);
  res.json({ template: updated });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const template = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  // Soft delete: existing tasks already reference the rate they were assigned, so
  // deactivating (not deleting) preserves history.
  db.prepare('UPDATE task_templates SET active = 0 WHERE id = ?').run(template.id);
  res.status(204).end();
});

module.exports = router;
