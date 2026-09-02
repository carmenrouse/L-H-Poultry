const LABELS = {
  assigned: 'Assigned',
  opened: 'Opened',
  completed: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
