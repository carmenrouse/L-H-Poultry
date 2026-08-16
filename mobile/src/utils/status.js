export function poStatusTone(status) {
  switch (status) {
    case 'DRAFT':
      return 'default';
    case 'SUBMITTED':
      return 'info';
    case 'PARTIALLY_RECEIVED':
      return 'warning';
    case 'RECEIVED':
      return 'success';
    case 'CANCELLED':
    case 'CLOSED':
      return 'danger';
    default:
      return 'default';
  }
}

export function formatMoney(value) {
  const n = Number(value);
  return `$${n.toFixed(2)}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
