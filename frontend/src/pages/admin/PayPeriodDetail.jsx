import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

export default function PayPeriodDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [minWage, setMinWage] = useState(null);
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    api
      .get(`/api/pay-periods/${id}`)
      .then((data) => {
        setPeriod(data.pay_period);
        setHours(data.pay_period.hours_worked ?? '');
        return Promise.all([api.get(`/api/users/${data.pay_period.employee_id}`), api.get('/api/settings')]);
      })
      .then(([userData, settingsData]) => {
        setEmployee(userData.user);
        setMinWage(settingsData.minimum_wage);
      })
      .catch((err) => setError(err.message));
  }

  async function handleClose(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post(`/api/pay-periods/${id}/close`, { hours_worked: Number(hours) });
      setPeriod(data.pay_period);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!period) {
    return (
      <>
        <TopBar title="Pay period" />
        <div className="main-content">{error ? <div className="error-banner">{error}</div> : <Spinner />}</div>
      </>
    );
  }

  const preview = previewCalc(period.task_pay_total, hours, minWage);

  return (
    <>
      <TopBar title={employee?.name || 'Pay period'} subtitle={`${period.start_date} → ${period.end_date}`} />
      <div className="main-content">
        <button className="btn-sm btn-secondary" style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>
          ← Back
        </button>

        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <div className="card-row">
            <span className="muted">Task pay total</span>
            <span className="rate-tag">${Number(period.task_pay_total).toFixed(2)}</span>
          </div>
        </div>

        {period.status === 'open' ? (
          <div className="card">
            <p className="card-title">Close this pay period</p>
            <p className="muted">
              Enter hours worked from your external time clock. TaskPay calculates effective hourly pay and applies a
              top-up if it falls below the minimum wage floor — this is a hard floor, always shown here, never
              silently skipped.
            </p>
            <form onSubmit={handleClose}>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="hours">Hours worked</label>
                <input id="hours" type="number" step="0.01" min="0" value={hours} onChange={(e) => setHours(e.target.value)} required />
              </div>

              {preview && (
                <div className={`floor-banner ${preview.topupAmount > 0 ? 'topup' : 'ok'}`}>
                  Effective hourly: {preview.effectiveHourly != null ? `$${preview.effectiveHourly.toFixed(2)}` : '—'}
                  {' · '}
                  Minimum wage floor: ${Number(minWage).toFixed(2)}/hr
                  <br />
                  {preview.topupAmount > 0
                    ? `Top-up needed: $${preview.topupAmount.toFixed(2)} → final pay $${preview.finalPay.toFixed(2)}`
                    : `No top-up needed → final pay $${preview.finalPay.toFixed(2)}`}
                </div>
              )}

              <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? 'Closing…' : 'Close pay period'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card">
            <p className="card-title">Closed — immutable record</p>
            <div className="card-row">
              <span className="muted">Hours worked</span>
              <span>{period.hours_worked}</span>
            </div>
            <div className="card-row">
              <span className="muted">Effective hourly</span>
              <span>{period.effective_hourly != null ? `$${Number(period.effective_hourly).toFixed(2)}` : '—'}</span>
            </div>
            <div className="card-row">
              <span className="muted">Minimum wage used</span>
              <span>${Number(period.minimum_wage_used).toFixed(2)}</span>
            </div>
            {period.topup_amount > 0 && (
              <div className="floor-banner topup">Top-up applied: +${Number(period.topup_amount).toFixed(2)}</div>
            )}
            <div className="card-row" style={{ marginTop: 10 }}>
              <strong>Final pay</strong>
              <strong className="rate-tag">${Number(period.final_pay).toFixed(2)}</strong>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Closed {new Date(period.closed_at).toLocaleString()}. This record cannot be edited — rate or pay-type
              changes never apply retroactively.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function previewCalc(taskPayTotal, hoursInput, minimumWage) {
  const hoursWorked = Number(hoursInput);
  if (hoursInput === '' || Number.isNaN(hoursWorked) || hoursWorked < 0 || minimumWage == null) return null;
  if (hoursWorked === 0) {
    return { effectiveHourly: null, topupAmount: 0, finalPay: taskPayTotal };
  }
  const effectiveHourly = taskPayTotal / hoursWorked;
  const floorPay = minimumWage * hoursWorked;
  const topupAmount = effectiveHourly < minimumWage ? Math.round((floorPay - taskPayTotal) * 100) / 100 : 0;
  const finalPay = Math.round((taskPayTotal + topupAmount) * 100) / 100;
  return { effectiveHourly, topupAmount, finalPay };
}
