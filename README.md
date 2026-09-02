# TaskPay

A piece-rate task accountability app for a small business (1–5 employees) with a mix
of hourly and piece-rate staff. Some employees are paid per the hour (tracked
elsewhere, outside this app); others are paid **per approved task** — TaskPay is the
system of record for that pay.

- **`backend/`** — Node.js/Express REST API on SQLite (`better-sqlite3`), JWT auth,
  role-based (admin/employee).
- **`frontend/`** — React (Vite) app, mobile-first, installable as a home-screen PWA.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env
npm install
npm run seed     # creates data/taskpay.db with sample users + tasks
npm run dev       # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173 (proxies /api to the backend)
```

Log in with a seeded account (password `password123` for all):
- `admin` — Admin, hourly
- `jamie` — Employee, piece-rate
- `alex` — Employee, hourly

## Core concept

Two roles: **Admin** (owner) and **Employee**. Tasks are assigned per employee, from
a reusable template or as a one-off. Employees mark tasks opened (a read receipt) and
completed (with an optional or required photo); an admin reviews each completed task
and approves or rejects it. Pay for a piece-rate task is granted **once, on approval**
— rejecting a task never changes its rate and never deducts pay, it simply withholds
payment until the employee's redo is approved. The full history of every attempt
(started/ended timestamps, outcome, note, photo) is preserved even as a task is
reopened and redone.

At the end of a pay period, an admin enters `hours_worked` from the business's
existing time clock. TaskPay sums approved task pay for that employee/period,
computes the effective hourly rate, and — if that falls below a configurable minimum
wage — automatically calculates a top-up so the employee is never paid under the
floor. This calculation is a pure, unit-tested function (`backend/src/services/payCalc.js`)
and the close-out screen always shows the floor, never skips it silently.

## Guardrails (enforced server-side, not just documented)

- **Rate is frozen at assignment.** A task's `rate` is copied from its template (or
  set manually for a one-off) when it's created. Rejecting a task increments
  `attempt_count` and creates a new `TaskAttempt` row, but never touches `rate`.
  Once a task is **approved**, it can no longer be edited at all (`PATCH /api/tasks/:id`
  returns 409) — its rate is a permanent part of a paid historical record.
- **Closed pay periods are immutable.** `POST /api/pay-periods/:id/close` computes and
  stores a snapshot (`task_pay_total`, `effective_hourly`, `minimum_wage_used`,
  `topup_amount`, `final_pay`) and flips `status` to `closed`. There is no general
  update endpoint for pay periods — closing again returns 409. Changing an employee's
  `pay_type`/`hourly_rate` afterwards only affects future periods, because closed
  periods never re-read live employee data.
- **The minimum-wage floor is never silently skipped.** `calculatePayPeriod()` always
  computes `effective_hourly` and a `topup_amount` whenever `hours_worked > 0`; the
  close-out UI shows a live preview of the exact same calculation before the admin
  confirms.

These are covered by `backend/tests/guardrails.test.js` (full open → complete →
reject → reopen → complete → approve → close cycle, driven through the real HTTP API)
and `backend/tests/payCalc.test.js` (the pure calculation, including edge cases like
zero hours worked and landing exactly on the floor).

## API routes

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | |
| GET | `/api/auth/me` | |
| GET/POST | `/api/users` | admin creates users |
| PATCH | `/api/users/:id` | pay_type/rate changes apply only going forward |
| GET/POST | `/api/task-templates` | |
| PATCH/DELETE | `/api/task-templates/:id` | delete = soft deactivate |
| GET/POST | `/api/tasks` | admin assigns; employees see only their own |
| GET | `/api/tasks/:id` | task + full attempt history |
| PATCH | `/api/tasks/:id` | blocked once approved |
| POST | `/api/tasks/:id/open` | employee read receipt |
| POST | `/api/tasks/:id/complete` | employee, optional/required photo |
| POST | `/api/tasks/:id/approve` | admin, grants pay |
| POST | `/api/tasks/:id/reject` | admin, requires note, reopens task |
| GET | `/api/tasks/export.csv` | admin task history export |
| GET/POST | `/api/pay-periods` | |
| GET | `/api/pay-periods/current-total` | employee's own running total |
| GET | `/api/pay-periods/:id` | |
| POST | `/api/pay-periods/:id/close` | one-time, computes the floor/top-up |
| GET | `/api/pay-periods/export.csv` | admin pay period summaries export |
| GET/PUT | `/api/settings` | minimum wage |
| GET | `/api/dashboard/employees/:id/stats` | approval rate, avg attempts, trend, redo-heavy tasks |
| GET | `/api/dashboard/overview` | admin: all employees at a glance |

## Tests

```bash
cd backend
npm test
```
