import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, API_URL } from '../../api/client';
import TopBar from '../../components/TopBar';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';

export default function ReviewTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    api
      .get(`/api/tasks/${id}`)
      .then((data) => {
        setTask(data.task);
        setAttempts(data.attempts);
        return api.get(`/api/users/${data.task.assigned_to}`);
      })
      .then((data) => setEmployee(data.user))
      .catch((err) => setError(err.message));
  }

  async function handleApprove() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/tasks/${id}/approve`);
      navigate('/admin/review');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectNote.trim()) {
      setError('A note is required to reject a task.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/tasks/${id}/reject`, { supervisor_note: rejectNote.trim() });
      navigate('/admin/review');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!task) {
    return (
      <>
        <TopBar title="Review task" />
        <div className="main-content">{error ? <div className="error-banner">{error}</div> : <Spinner />}</div>
      </>
    );
  }

  return (
    <>
      <TopBar title={task.title} subtitle={employee?.name} />
      <div className="main-content">
        <button className="btn-sm btn-secondary" style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>
          ← Back
        </button>

        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <div className="card-row">
            <StatusBadge status={task.status} />
            <span className="rate-tag">${Number(task.rate).toFixed(2)}</span>
          </div>
          {task.description && <p style={{ marginTop: 10 }}>{task.description}</p>}
          <p className="muted" style={{ marginTop: 6 }}>
            Attempt {task.attempt_count} · assigned {task.assigned_date}
          </p>
        </div>

        {task.employee_note && (
          <div className="card">
            <p className="card-title">Employee note</p>
            <p style={{ margin: 0 }}>{task.employee_note}</p>
          </div>
        )}

        {task.photo_url && (
          <div className="card">
            <p className="card-title">Photo</p>
            <img className="photo-preview" src={`${API_URL}${task.photo_url}`} alt="Task completion" />
          </div>
        )}

        {task.status === 'completed' && (
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleApprove} disabled={busy}>
              Approve
            </button>
            <button className="btn btn-danger" onClick={() => setShowReject(true)} disabled={busy}>
              Reject
            </button>
          </div>
        )}

        {showReject && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="rejectNote">Reason for rejection (required)</label>
              <textarea id="rejectNote" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-danger" onClick={handleReject} disabled={busy}>
              {busy ? 'Submitting…' : 'Confirm reject & reopen task'}
            </button>
          </div>
        )}

        {attempts.length > 1 && (
          <>
            <div className="section-title">Full attempt history</div>
            <div className="card">
              {[...attempts].reverse().map((a) => (
                <div key={a.id} className={`attempt-item outcome-${a.outcome || 'pending'}`}>
                  <div className="card-row">
                    <strong>Attempt {a.attempt_number}</strong>
                    {a.outcome && <StatusBadge status={a.outcome === 'approved' ? 'approved' : 'rejected'} />}
                  </div>
                  {a.note && <p className="muted" style={{ margin: '4px 0 0' }}>{a.note}</p>}
                  {a.photo_url && a.attempt_number !== task.attempt_count && (
                    <img
                      className="photo-preview"
                      src={`${API_URL}${a.photo_url}`}
                      alt={`Attempt ${a.attempt_number}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
