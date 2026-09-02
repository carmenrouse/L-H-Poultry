const fs = require('fs');
const path = require('path');
const os = require('os');

let app;
let dbFile;

beforeAll(() => {
  dbFile = path.join(os.tmpdir(), `taskpay-test-${Date.now()}.db`);
  process.env.DB_PATH = dbFile;
  process.env.JWT_SECRET = 'test-secret';
  process.env.DEFAULT_MINIMUM_WAGE = '7.25';
  jest.resetModules();
  app = require('../src/app');
});

afterAll(() => {
  for (const ext of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbFile + ext);
    } catch (e) {
      // ignore
    }
  }
});

const request = require('supertest');

async function login(username, password = 'password123') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.token;
}

describe('TaskPay guardrails', () => {
  let adminToken;
  let employeeId;
  let employeeToken;
  let taskId;

  test('setup: create admin and piece-rate employee', async () => {
    // bootstrap: no users exist yet, so seed directly through the db module
    const db = require('../src/db');
    const bcrypt = require('bcryptjs');
    db.prepare(
      `INSERT INTO users (name, username, role, pay_type, hourly_rate, password_hash)
       VALUES (?, ?, 'admin', 'hourly', 20, ?)`
    ).run('Admin', 'admin', bcrypt.hashSync('password123', 10));
    adminToken = await login('admin');
    expect(adminToken).toBeTruthy();

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Employee', username: 'emp', role: 'employee', pay_type: 'piece_rate', password: 'password123' });
    expect(res.status).toBe(201);
    employeeId = res.body.user.id;
    employeeToken = await login('emp');
  });

  test('rejecting a task never changes its rate, and pay is granted only once on approval', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigned_to: employeeId, assigned_date: today, title: 'Pack boxes', rate: 5, requires_photo: false });
    expect(createRes.status).toBe(201);
    taskId = createRes.body.task.id;
    expect(createRes.body.task.rate).toBe(5);

    await request(app).post(`/api/tasks/${taskId}/open`).set('Authorization', `Bearer ${employeeToken}`);
    await request(app)
      .post(`/api/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employee_note: 'first try' });

    const rejectRes = await request(app)
      .post(`/api/tasks/${taskId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supervisor_note: 'not stacked right' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.task.status).toBe('assigned');
    expect(rejectRes.body.task.attempt_count).toBe(2);
    expect(rejectRes.body.task.rate).toBe(5); // rate unchanged by rejection
    expect(rejectRes.body.attempts).toHaveLength(2);
    expect(rejectRes.body.attempts[0].outcome).toBe('rejected');
    expect(rejectRes.body.attempts[1].outcome).toBeNull();

    await request(app).post(`/api/tasks/${taskId}/open`).set('Authorization', `Bearer ${employeeToken}`);
    await request(app)
      .post(`/api/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ employee_note: 'second try' });

    const approveRes = await request(app)
      .post(`/api/tasks/${taskId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.task.status).toBe('approved');
    expect(approveRes.body.task.rate).toBe(5); // still the original rate, paid once
  });

  test('an approved task cannot be edited', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rate: 999 });
    expect(res.status).toBe(409);
  });

  test('a closed pay period cannot be closed again (immutable once closed)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const createPeriod = await request(app)
      .post('/api/pay-periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_id: employeeId, start_date: today, end_date: today });
    const periodId = createPeriod.body.pay_period.id;

    const closeRes = await request(app)
      .post(`/api/pay-periods/${periodId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours_worked: 2 });
    expect(closeRes.status).toBe(200);
    // task_pay_total is 5 (one approved task), hours=2, min wage 7.25 -> floor 14.5
    expect(closeRes.body.pay_period.task_pay_total).toBe(5);
    expect(closeRes.body.pay_period.topup_amount).toBe(9.5);
    expect(closeRes.body.pay_period.final_pay).toBe(14.5);

    const secondClose = await request(app)
      .post(`/api/pay-periods/${periodId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hours_worked: 100 });
    expect(secondClose.status).toBe(409);

    // Changing the employee's pay_type/rate afterwards must not retroactively
    // touch the closed period's stored snapshot.
    await request(app)
      .patch(`/api/users/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pay_type: 'hourly', hourly_rate: 50 });

    const reread = await request(app)
      .get(`/api/pay-periods/${periodId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reread.body.pay_period.task_pay_total).toBe(5);
    expect(reread.body.pay_period.final_pay).toBe(14.5);
  });

  test('employees cannot act on tasks assigned to someone else', async () => {
    const otherToken = await (async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Other', username: 'other', role: 'employee', pay_type: 'piece_rate', password: 'password123' });
      return login('other');
    })();

    const res = await request(app).post(`/api/tasks/${taskId}/open`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});
