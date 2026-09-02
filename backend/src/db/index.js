const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'taskpay.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const DEFAULT_MINIMUM_WAGE = process.env.DEFAULT_MINIMUM_WAGE || '7.25';
const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('minimum_wage');
if (!existing) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('minimum_wage', DEFAULT_MINIMUM_WAGE);
}

module.exports = db;
