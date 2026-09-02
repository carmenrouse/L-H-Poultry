import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

const EMPTY_FORM = { name: '', username: '', role: 'employee', pay_type: 'piece_rate', hourly_rate: '', password: '' };

export default function Employees() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api
      .get('/api/users')
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        username: form.username,
        role: form.role,
        pay_type: form.pay_type,
        password: form.password,
      };
      if (form.pay_type === 'hourly') payload.hourly_rate = Number(form.hourly_rate);
      await api.post('/api/users', payload);
      setForm(EMPTY_FORM);
      setShowNew(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updatePayType(user, pay_type) {
    setError('');
    setBusy(true);
    try {
      const payload = { pay_type };
      if (pay_type === 'hourly') {
        const rate = window.prompt('Hourly rate ($)', user.hourly_rate || '15');
        if (rate === null) {
          setBusy(false);
          return;
        }
        payload.hourly_rate = Number(rate);
      }
      await api.patch(`/api/users/${user.id}`, payload);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Team" subtitle="Pay type is applied to future pay periods only" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Cancel' : '+ Add team member'}
        </button>

        {showNew && (
          <div className="card">
            <form onSubmit={handleCreate}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pay_type">Pay type</label>
                <select id="pay_type" value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
                  <option value="piece_rate">Piece-rate (tracked by TaskPay)</option>
                  <option value="hourly">Hourly (tracked elsewhere)</option>
                </select>
              </div>
              {form.pay_type === 'hourly' && (
                <div className="field">
                  <label htmlFor="hourly_rate">Hourly rate ($)</label>
                  <input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="password">Temporary password</label>
                <input
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Create
              </button>
            </form>
          </div>
        )}

        <div className="section-title">Team members</div>
        {!users && <Spinner />}
        {users?.map((u) => (
          <div className="card" key={u.id}>
            <div className="card-row">
              <p className="card-title">{u.name}</p>
              <span className="badge badge-assigned">{u.role}</span>
            </div>
            <div className="card-row" style={{ marginTop: 8 }}>
              <span className="muted">@{u.username}</span>
              <span>{u.pay_type === 'piece_rate' ? 'Piece-rate' : `Hourly · $${u.hourly_rate}/hr`}</span>
            </div>
            <div className="pill-toggle" style={{ marginTop: 10 }}>
              <button
                className={u.pay_type === 'piece_rate' ? 'active' : ''}
                onClick={() => updatePayType(u, 'piece_rate')}
                disabled={busy}
              >
                Piece-rate
              </button>
              <button className={u.pay_type === 'hourly' ? 'active' : ''} onClick={() => updatePayType(u, 'hourly')} disabled={busy}>
                Hourly
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
