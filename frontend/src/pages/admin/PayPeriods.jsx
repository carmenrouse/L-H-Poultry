import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

const today = new Date().toISOString().slice(0, 10);

export default function PayPeriods() {
  const [periods, setPeriods] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [minWage, setMinWage] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employee_id: '', start_date: today, end_date: today });
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    Promise.all([api.get('/api/pay-periods'), api.get('/api/users'), api.get('/api/settings')])
      .then(([periodData, userData, settingsData]) => {
        setPeriods(periodData.pay_periods);
        const emps = userData.users.filter((u) => u.role === 'employee' && u.pay_type === 'piece_rate');
        setEmployees(emps);
        setMinWage(settingsData.minimum_wage);
        if (emps[0] && !form.employee_id) setForm((f) => ({ ...f, employee_id: emps[0].id }));
      })
      .catch((err) => setError(err.message));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/api/pay-periods', {
        employee_id: Number(form.employee_id),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      setShowNew(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleWageChange(e) {
    const value = e.target.value;
    setMinWage(value);
  }

  async function saveWage() {
    setBusy(true);
    setError('');
    try {
      await api.put('/api/settings', { minimum_wage: Number(minWage) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const employeeNames = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  return (
    <>
      <TopBar title="Pay periods" subtitle="Close-out with minimum-wage floor" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <p className="card-title">Minimum wage floor</p>
          <p className="muted">Applied to every pay period close-out. Always shown, never silently skipped.</p>
          <div className="field" style={{ marginTop: 10 }}>
            <input type="number" step="0.01" min="0" value={minWage ?? ''} onChange={handleWageChange} />
          </div>
          <button className="btn btn-secondary" onClick={saveWage} disabled={busy}>
            Save minimum wage
          </button>
        </div>

        <button className="btn btn-secondary" style={{ margin: '16px 0' }} onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Cancel' : '+ New pay period'}
        </button>

        {showNew && (
          <div className="card">
            <form onSubmit={handleCreate}>
              <div className="field">
                <label htmlFor="employee_id">Employee (piece-rate)</label>
                <select
                  id="employee_id"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="start_date">Start date</label>
                <input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="end_date">End date</label>
                <input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || employees.length === 0}>
                Create pay period
              </button>
              {employees.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No piece-rate employees yet.</p>}
            </form>
          </div>
        )}

        <div className="section-title">All pay periods</div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 12, display: 'inline-flex' }}
          onClick={() => downloadCsv('/api/pay-periods/export.csv', 'pay_periods.csv')}
        >
          Export CSV
        </button>

        {!periods && <Spinner />}
        {periods?.length === 0 && <p className="muted">No pay periods yet.</p>}
        {periods?.map((p) => (
          <Link key={p.id} to={`/admin/pay-periods/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div className="card-row">
                <p className="card-title">{employeeNames[p.employee_id] || `Employee #${p.employee_id}`}</p>
                <span className={`badge ${p.status === 'closed' ? 'badge-approved' : 'badge-assigned'}`}>
                  {p.status === 'closed' ? 'Closed' : 'Open'}
                </span>
              </div>
              <div className="card-row" style={{ marginTop: 6 }}>
                <span className="muted">
                  {p.start_date} → {p.end_date}
                </span>
                {p.status === 'closed' && <span className="rate-tag">${Number(p.final_pay).toFixed(2)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

async function downloadCsv(path, filename) {
  const text = await api.get(path);
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
