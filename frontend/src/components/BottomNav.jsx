import { NavLink } from 'react-router-dom';

const EMPLOYEE_TABS = [
  { to: '/today', icon: '✓', label: 'Today' },
  { to: '/history', icon: '📋', label: 'History' },
];

const ADMIN_TABS = [
  { to: '/admin/review', icon: '🔍', label: 'Review' },
  { to: '/admin/assign', icon: '➕', label: 'Assign' },
  { to: '/admin/templates', icon: '🗂️', label: 'Templates' },
  { to: '/admin/employees', icon: '👥', label: 'Team' },
  { to: '/admin/pay-periods', icon: '💵', label: 'Pay' },
  { to: '/admin/dashboard', icon: '📊', label: 'Stats' },
];

export default function BottomNav({ role }) {
  const tabs = role === 'admin' ? ADMIN_TABS : EMPLOYEE_TABS;
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
