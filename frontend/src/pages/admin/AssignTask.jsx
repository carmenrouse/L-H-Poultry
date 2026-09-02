import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

const today = new Date().toISOString().slice(0, 10);

export default function AssignTask() {
  const [employees, setEmployees] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState('template');
  const [form, setForm] = useState({
    assigned_to: '',
    assigned_date: today,
    template_id: '',
    title: '',
    description: '',
    rate: '',
    requires_photo: false,
  });

  useEffect(() => {
    Promise.all([api.get('/api/users'), api.get('/api/task-templates')])
      .then(([userData, templateData]) => {
        const emps = userData.users.filter((u) => u.role === 'employee');
        setEmployees(emps);
        setTemplates(templateData.templates);
        if (emps[0]) setForm((f) => ({ ...f, assigned_to: emps[0].id }));
      })
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function selectedTemplate() {
    return templates?.find((t) => String(t.id) === String(form.template_id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const payload = {
        assigned_to: Number(form.assigned_to),
        assigned_date: form.assigned_date,
      };
      if (mode === 'template') {
        if (!form.template_id) throw new Error('Choose a task template');
        payload.template_id = Number(form.template_id);
      } else {
        if (!form.title || form.rate === '') throw new Error('Title and rate are required for a one-off task');
        payload.title = form.title;
        payload.description = form.description;
        payload.rate = Number(form.rate);
        payload.requires_photo = form.requires_photo;
      }
      await api.post('/api/tasks', payload);
      setSuccess('Task assigned.');
      setForm((f) => ({ ...f, title: '', description: '', rate: '', requires_photo: false, template_id: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!employees || !templates) {
    return (
      <>
        <TopBar title="Assign task" />
        <div className="main-content">
          <Spinner />
        </div>
      </>
    );
  }

  const tpl = selectedTemplate();

  return (
    <>
      <TopBar title="Assign task" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="floor-banner ok">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="assigned_to">Employee</label>
            <select id="assigned_to" value={form.assigned_to} onChange={(e) => update('assigned_to', e.target.value)}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.pay_type === 'piece_rate' ? 'piece-rate' : 'hourly'})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="assigned_date">Date</label>
            <input
              id="assigned_date"
              type="date"
              value={form.assigned_date}
              onChange={(e) => update('assigned_date', e.target.value)}
            />
          </div>

          <div className="pill-toggle" style={{ marginBottom: 14 }}>
            <button type="button" className={mode === 'template' ? 'active' : ''} onClick={() => setMode('template')}>
              From template
            </button>
            <button type="button" className={mode === 'oneoff' ? 'active' : ''} onClick={() => setMode('oneoff')}>
              One-off task
            </button>
          </div>

          {mode === 'template' ? (
            <div className="field">
              <label htmlFor="template_id">Task template</label>
              <select id="template_id" value={form.template_id} onChange={(e) => update('template_id', e.target.value)}>
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — ${Number(t.default_rate).toFixed(2)}
                  </option>
                ))}
              </select>
              {tpl && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {tpl.description} {tpl.requires_photo ? '· photo required' : ''}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" value={form.title} onChange={(e) => update('title', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea id="description" value={form.description} onChange={(e) => update('description', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="rate">Rate ($)</label>
                <input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate}
                  onChange={(e) => update('rate', e.target.value)}
                />
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={form.requires_photo}
                    onChange={(e) => update('requires_photo', e.target.checked)}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Require a photo to complete
                </label>
              </div>
            </>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Assigning…' : 'Assign task'}
          </button>
        </form>
      </div>
    </>
  );
}
