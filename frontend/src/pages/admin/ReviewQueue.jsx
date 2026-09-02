import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';

export default function ReviewQueue() {
  const [tasks, setTasks] = useState(null);
  const [employees, setEmployees] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  function load() {
    Promise.all([api.get('/api/tasks?status=completed'), api.get('/api/users')])
      .then(([taskData, userData]) => {
        setTasks(taskData.tasks);
        setEmployees(Object.fromEntries(userData.users.map((u) => [u.id, u.name])));
      })
      .catch((err) => setError(err.message));
  }

  return (
    <>
      <TopBar title="Review queue" subtitle="Completed tasks awaiting your call" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}
        {!tasks && <Spinner />}
        {tasks?.length === 0 && <div className="empty-state">Nothing waiting on review. 🎉</div>}
        {tasks?.map((task) => (
          <Link key={task.id} to={`/admin/review/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div className="card-row">
                <p className="card-title">{task.title}</p>
                <span className="rate-tag">${Number(task.rate).toFixed(2)}</span>
              </div>
              <div className="card-row" style={{ marginTop: 6 }}>
                <span className="muted">{employees[task.assigned_to] || 'Unknown'}</span>
                {task.attempt_count > 1 && <span className="muted">Attempt {task.attempt_count}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
