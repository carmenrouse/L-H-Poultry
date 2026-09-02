const bcrypt = require('bcryptjs');
const db = require('./index');

function upsertUser({ name, username, role, pay_type, hourly_rate, password }) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return existing.id;
  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (name, username, role, pay_type, hourly_rate, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, username, role, pay_type, hourly_rate ?? null, password_hash);
  return info.lastInsertRowid;
}

const adminId = upsertUser({
  name: 'Carmen Rouse',
  username: 'admin',
  role: 'admin',
  pay_type: 'hourly',
  hourly_rate: 25,
  password: 'password123',
});

const pieceEmployeeId = upsertUser({
  name: 'Jamie Cutter',
  username: 'jamie',
  role: 'employee',
  pay_type: 'piece_rate',
  hourly_rate: null,
  password: 'password123',
});

const hourlyEmployeeId = upsertUser({
  name: 'Alex Packer',
  username: 'alex',
  role: 'employee',
  pay_type: 'hourly',
  hourly_rate: 15,
  password: 'password123',
});

const templateExists = db.prepare('SELECT id FROM task_templates LIMIT 1').get();
if (!templateExists) {
  const insertTemplate = db.prepare(
    `INSERT INTO task_templates (title, description, default_rate, requires_photo)
     VALUES (?, ?, ?, ?)`
  );
  const t1 = insertTemplate.run('Debone 50lb case', 'Debone a full case of thighs', 12.5, 1);
  const t2 = insertTemplate.run('Clean processing line', 'End of shift line cleandown', 8, 1);
  insertTemplate.run('Pack retail trays', 'Pack and label trays for retail case', 0.35, 0);

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO tasks (template_id, assigned_to, assigned_date, title, description, rate, requires_photo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(t1.lastInsertRowid, pieceEmployeeId, today, 'Debone 50lb case', 'Debone a full case of thighs', 12.5, 1);
  db.prepare(
    `INSERT INTO task_attempts (task_id, attempt_number) VALUES (last_insert_rowid(), 1)`
  ).run();

  db.prepare(
    `INSERT INTO tasks (template_id, assigned_to, assigned_date, title, description, rate, requires_photo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(t2.lastInsertRowid, pieceEmployeeId, today, 'Clean processing line', 'End of shift line cleandown', 8, 1);
  db.prepare(
    `INSERT INTO task_attempts (task_id, attempt_number) VALUES (last_insert_rowid(), 1)`
  ).run();
}

console.log('Seed complete.');
console.log('  admin / password123 (admin, hourly)');
console.log('  jamie / password123 (employee, piece_rate)');
console.log('  alex  / password123 (employee, hourly)');

// Closing explicitly finalizes every cached prepared statement before the
// process exits. On some better-sqlite3/Node combinations, leaving that to
// happen implicitly during Node's shutdown teardown crashes the process.
db.close();
