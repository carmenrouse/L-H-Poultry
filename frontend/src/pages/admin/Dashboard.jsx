import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

async function exportTaskHistory() {
  const text = await api.get('/api/tasks/export.csv');
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'task_history.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/dashboard/overview')
      .then((data) => setOverview(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <TopBar title="Dashboard" subtitle="Per-employee performance" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={exportTaskHistory}>
          Export task history CSV
        </button>

        {!overview && <Spinner />}

        {overview && (
          <div className="stat-tile" style={{ marginBottom: 16 }}>
            <div className="value">{overview.pendingReview}</div>
            <div className="label">Tasks awaiting review</div>
          </div>
        )}

        {overview?.overview.map((row) => (
          <div className="card" key={row.employee.id}>
            <p className="card-title">{row.employee.name}</p>
            <div className="stat-grid" style={{ marginTop: 10 }}>
              <div className="stat-tile">
                <div className="value">{row.approvalRateFirstAttempt != null ? `${row.approvalRateFirstAttempt}%` : '—'}</div>
                <div className="label">1st-attempt approval</div>
              </div>
              <div className="stat-tile">
                <div className="value">{row.avgAttemptsPerTask ?? '—'}</div>
                <div className="label">Avg attempts / task</div>
              </div>
              <div className="stat-tile">
                <div className="value">
                  {row.latestEffectiveHourly != null ? `$${Number(row.latestEffectiveHourly).toFixed(2)}` : '—'}
                </div>
                <div className="label">Latest effective hourly</div>
              </div>
              <div className="stat-tile">
                <div className="value">{row.redoHeavyTaskTypes.length}</div>
                <div className="label">Redo-heavy task types</div>
              </div>
            </div>

            {row.redoHeavyTaskTypes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p className="muted" style={{ marginBottom: 6 }}>
                  Most-redone tasks (may signal a poorly specified task, not just performance):
                </p>
                {row.redoHeavyTaskTypes.map((t) => (
                  <div className="card-row" key={t.title}>
                    <span>{t.title}</span>
                    <span className="muted">{t.avgAttempts} avg attempts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
