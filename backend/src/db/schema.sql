CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin','employee')),
  pay_type TEXT NOT NULL CHECK(pay_type IN ('hourly','piece_rate')),
  hourly_rate REAL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  default_rate REAL NOT NULL,
  requires_photo INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER REFERENCES task_templates(id),
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  assigned_date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  rate REAL NOT NULL,
  requires_photo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','opened','completed','approved','rejected')),
  opened_at TEXT,
  completed_at TEXT,
  approved_at TEXT,
  photo_url TEXT,
  employee_note TEXT,
  supervisor_note TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  attempt_number INTEGER NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  outcome TEXT CHECK(outcome IN ('approved','rejected')),
  note TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pay_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  hours_worked REAL,
  task_pay_total REAL NOT NULL DEFAULT 0,
  effective_hourly REAL,
  minimum_wage_used REAL,
  topup_amount REAL NOT NULL DEFAULT 0,
  final_pay REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_date ON tasks(assigned_date);
CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id ON task_attempts(task_id);
CREATE INDEX IF NOT EXISTS idx_pay_periods_employee ON pay_periods(employee_id);
