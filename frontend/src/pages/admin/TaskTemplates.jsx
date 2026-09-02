import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

const EMPTY_FORM = { title: '', description: '', default_rate: '', requires_photo: false };

export default function TaskTemplates() {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api
      .get('/api/task-templates')
      .then((data) => setTemplates(data.templates))
      .catch((err) => setError(err.message));
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ title: t.title, description: t.description || '', default_rate: t.default_rate, requires_photo: !!t.requires_photo });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        default_rate: Number(form.default_rate),
        requires_photo: form.requires_photo,
      };
      if (editingId) {
        await api.patch(`/api/task-templates/${editingId}`, payload);
      } else {
        await api.post('/api/task-templates', payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(id) {
    setBusy(true);
    setError('');
    try {
      await api.del(`/api/task-templates/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Task templates" subtitle="Reusable tasks + default rates" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        <div className="card">
          <p className="card-title">{editingId ? 'Edit template' : 'New template'}</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="default_rate">Default rate ($)</label>
              <input
                id="default_rate"
                type="number"
                step="0.01"
                min="0"
                value={form.default_rate}
                onChange={(e) => setForm({ ...form, default_rate: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.requires_photo}
                  onChange={(e) => setForm({ ...form, requires_photo: e.target.checked })}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                Require a photo to complete
              </label>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {editingId ? 'Save changes' : 'Create template'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="section-title">Existing templates</div>
        {!templates && <Spinner />}
        {templates?.length === 0 && <p className="muted">No templates yet.</p>}
        {templates?.map((t) => (
          <div className="card" key={t.id}>
            <div className="card-row">
              <p className="card-title">{t.title}</p>
              <span className="rate-tag">${Number(t.default_rate).toFixed(2)}</span>
            </div>
            {t.description && <p className="muted" style={{ margin: '6px 0' }}>{t.description}</p>}
            {t.requires_photo ? <p className="muted">📷 Photo required</p> : null}
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => startEdit(t)}>
                Edit
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(t.id)} disabled={busy}>
                Deactivate
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
