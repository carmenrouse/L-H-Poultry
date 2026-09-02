import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Spinner from './components/Spinner';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';

import TodayTasks from './pages/employee/TodayTasks';
import TaskDetail from './pages/employee/TaskDetail';
import History from './pages/employee/History';

import ReviewQueue from './pages/admin/ReviewQueue';
import ReviewTaskDetail from './pages/admin/ReviewTaskDetail';
import AssignTask from './pages/admin/AssignTask';
import TaskTemplates from './pages/admin/TaskTemplates';
import Employees from './pages/admin/Employees';
import PayPeriods from './pages/admin/PayPeriods';
import PayPeriodDetail from './pages/admin/PayPeriodDetail';
import Dashboard from './pages/admin/Dashboard';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin/review' : '/today'} replace />;
  }
  return children;
}

function AppShell({ role, children }) {
  return (
    <div className="app-shell">
      {children}
      <BottomNav role={role} />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route
        path="/"
        element={<Navigate to={user?.role === 'admin' ? '/admin/review' : '/today'} replace />}
      />

      {/* Employee */}
      <Route
        path="/today"
        element={
          <Protected role="employee">
            <AppShell role="employee">
              <TodayTasks />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <Protected role="employee">
            <AppShell role="employee">
              <TaskDetail />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/history"
        element={
          <Protected role="employee">
            <AppShell role="employee">
              <History />
            </AppShell>
          </Protected>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/review"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <ReviewQueue />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/review/:id"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <ReviewTaskDetail />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/assign"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <AssignTask />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/templates"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <TaskTemplates />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <Employees />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/pay-periods"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <PayPeriods />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/pay-periods/:id"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <PayPeriodDetail />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <Protected role="admin">
            <AppShell role="admin">
              <Dashboard />
            </AppShell>
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
