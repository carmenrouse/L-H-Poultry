import { useAuth } from '../context/AuthContext';

export default function TopBar({ title, subtitle }) {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      {user && (
        <button className="icon-btn" onClick={logout}>
          Log out
        </button>
      )}
    </div>
  );
}
