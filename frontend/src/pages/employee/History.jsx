import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';

export default function History() {
  const [tasks, setTasks] = useState(null);
  const [payPeriods, setPayPeriods] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/tasks'), api.get('/api/pay-periods')])
      .then(([taskData, periodData]) => {
        setTasks(taskData.tasks);
        setPayPeriods(periodData.pay_periods);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <TopBar title="History" subtitle="Your tasks and pay" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        <div className="section-title">Pay periods</div>
        {!payPeriods && <Spinner />}
        {payPeriods?.length === 0 && <p className="muted">No pay periods yet.</p>}
        {payPeriods?.map((p) => (
          <div className="card" key={p.id}>
            <div className="card-row">
              <p className="card-title">
                {p.start_date} → {p.end_date}
              </p>
              <span className={`badge ${p.status === 'closed' ? 'badge-approved' : 'badge-assigned'}`}>
                {p.status === 'closed' ? 'Closed' : 'Open'}
              </span>
            </div>
            <div className="card-row" style={{ marginTop: 8 }}>
              <span className="muted">Task pay</span>
              <span>${Number(p.task_pay_total).toFixed(2)}</span>
            </div>
            {p.status === 'closed' && (
              <>
                <div className="card-row">
                  <span className="muted">Hours worked</span>
                  <span>{p.hours_worked}</span>
                </div>
                <div className="card-row">
                  <span className="muted">Effective hourly</span>
                  <span>{p.effective_hourly != null ? `$${Number(p.effective_hourly).toFixed(2)}` : '—'}</span>
                </div>
                {p.topup_amount > 0 && (
                  <div className="floor-banner topup">
                    Minimum-wage top-up: +${Number(p.topup_amount).toFixed(2)} (floor ${Number(p.minimum_wage_used).toFixed(2)}/hr)
                  </div>
                )}
                <div className="card-row" style={{ marginTop: 8 }}>
                  <strong>Final pay</strong>
                  <strong className="rate-tag">${Number(p.final_pay).toFixed(2)}</strong>
                </div>
              </>
            )}
          </div>
        ))}

        <div className="section-title">All tasks</div>
        {!tasks && <Spinner />}
        {tasks?.length === 0 && <p className="muted">No tasks yet.</p>}
        {tasks?.map((task) => (
          <Link key={task.id} to={`/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div className="card-row">
                <p className="card-title">{task.title}</p>
                <StatusBadge status={task.status} />
              </div>
              <div className="card-row" style={{ marginTop: 6 }}>
                <span className="muted">{task.assigned_date}</span>
                <span className="rate-tag">${Number(task.rate).toFixed(2)}</span>
              </div>
              {task.attempt_count > 1 && <p className="muted" style={{ marginTop: 4 }}>{task.attempt_count} attempts</p>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
