import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import TopBar from '../../components/TopBar';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';

export default function TodayTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [runningTotal, setRunningTotal] = useState(null);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError('');
    try {
      const [tasksData, totalData] = await Promise.all([
        api.get(`/api/tasks?date=${today}`),
        api.get('/api/pay-periods/current-total'),
      ]);
      setTasks(tasksData.tasks);
      setRunningTotal(totalData);
    } catch (err) {
      setError(err.message);
    }
  }

  const activeTasks = tasks?.filter((t) => t.status !== 'approved') || [];
  const doneTasks = tasks?.filter((t) => t.status === 'approved') || [];

  return (
    <>
      <TopBar title={`Hi, ${user.name.split(' ')[0]}`} subtitle="Today's tasks" />
      <div className="main-content">
        {error && <div className="error-banner">{error}</div>}

        {user.pay_type === 'piece_rate' && runningTotal && (
          <div className="stat-tile" style={{ marginBottom: 16 }}>
            <div className="value">${runningTotal.task_pay_total.toFixed(2)}</div>
            <div className="label">Approved task pay since {runningTotal.since}</div>
          </div>
        )}

        {!tasks && <Spinner />}

        {tasks && activeTasks.length === 0 && doneTasks.length === 0 && (
          <div className="empty-state">No tasks assigned for today.</div>
        )}

        {activeTasks.length > 0 && (
          <>
            <div className="section-title">To do</div>
            {activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </>
        )}

        {doneTasks.length > 0 && (
          <>
            <div className="section-title">Approved today</div>
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function TaskCard({ task }) {
  return (
    <Link to={`/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card">
        <div className="card-row">
          <p className="card-title">{task.title}</p>
          <StatusBadge status={task.status} />
        </div>
        <div className="card-row" style={{ marginTop: 8 }}>
          <span className="rate-tag">${Number(task.rate).toFixed(2)}</span>
          {task.attempt_count > 1 && <span className="muted">Attempt {task.attempt_count}</span>}
        </div>
        {task.supervisor_note && task.status === 'assigned' && task.attempt_count > 1 && (
          <p className="muted" style={{ marginTop: 8 }}>
            Redo note: {task.supervisor_note}
          </p>
        )}
      </div>
    </Link>
  );
}
