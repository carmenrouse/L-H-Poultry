import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, API_URL } from '../../api/client';
import TopBar from '../../components/TopBar';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setError('');
    try {
      const data = await api.get(`/api/tasks/${id}`);
      setTask(data.task);
      setAttempts(data.attempts);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleOpen() {
    setBusy(true);
    setError('');
    try {
      const data = await api.post(`/api/tasks/${id}/open`);
      setTask(data.task);
      setAttempts(data.attempts);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    setPhotoFile(file || null);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleComplete() {
    if (task.requires_photo && !photoFile) {
      setError('A photo is required to complete this task.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      if (note) form.append('employee_note', note);
      if (photoFile) form.append('photo', photoFile);
      const data = await api.post(`/api/tasks/${id}/complete`, form, { isForm: true });
      setTask(data.task);
      setAttempts(data.attempts);
      setNote('');
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!task) {
    return (
      <>
        <TopBar title="Task" />
        <div className="main-content">{error ? <div className="error-banner">{error}</div> : <Spinner />}</div>
      </>
    );
  }

  const canOpen = task.status === 'assigned';
  const awaitingReview = task.status === 'completed';
  const approved = task.status === 'approved';

  return (
    <>
      <TopBar title={task.title} subtitle={`Assigned ${task.assigned_date}`} />
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
          {task.attempt_count > 1 && (
            <p className="muted" style={{ marginTop: 6 }}>
              Attempt {task.attempt_count}
            </p>
          )}
          {task.requires_photo && <p className="muted" style={{ marginTop: 6 }}>📷 Photo required to complete</p>}
        </div>

        {task.supervisor_note && !approved && (
          <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
            <p className="card-title" style={{ color: 'var(--color-danger)' }}>
              Redo requested
            </p>
            <p style={{ margin: 0 }}>{task.supervisor_note}</p>
          </div>
        )}

        {approved && (
          <div className="floor-banner ok">Approved — ${Number(task.rate).toFixed(2)} counted toward your pay.</div>
        )}

        {awaitingReview && <div className="empty-state">Waiting on admin review.</div>}

        {canOpen && (
          <button className="btn btn-primary" onClick={handleOpen} disabled={busy}>
            Open task
          </button>
        )}

        {task.status === 'opened' && (
          <div className="card">
            <p className="card-title">Mark complete</p>
            <div className="field">
              <label htmlFor="note">Note (optional)</label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="photo">{task.requires_photo ? 'Photo (required)' : 'Photo (optional)'}</label>
              <input
                id="photo"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
              />
              {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
            </div>
            <button className="btn btn-primary" onClick={handleComplete} disabled={busy}>
              {busy ? 'Submitting…' : 'Mark Complete'}
            </button>
          </div>
        )}

        {attempts.length > 1 && (
          <>
            <div className="section-title">Attempt history</div>
            <div className="card">
              {[...attempts].reverse().map((a) => (
                <div key={a.id} className={`attempt-item outcome-${a.outcome || 'pending'}`}>
                  <div className="card-row">
                    <strong>Attempt {a.attempt_number}</strong>
                    {a.outcome && <StatusBadge status={a.outcome === 'approved' ? 'approved' : 'rejected'} />}
                  </div>
                  {a.note && <p className="muted" style={{ margin: '4px 0 0' }}>{a.note}</p>}
                  {a.photo_url && (
                    <img className="photo-preview" src={`${API_URL}${a.photo_url}`} alt={`Attempt ${a.attempt_number}`} />
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
