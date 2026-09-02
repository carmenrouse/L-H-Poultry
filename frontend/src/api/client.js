const API_URL = import.meta.env.VITE_API_URL || '';

let authToken = localStorage.getItem('taskpay_token') || null;

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('taskpay_token', token);
  else localStorage.removeItem('taskpay_token');
}

export function getToken() {
  return authToken;
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const isCsv = contentType.includes('text/csv');

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch (e) {
      // ignore parse failure
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  if (isCsv) return res.text();
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export { API_URL };
