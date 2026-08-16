function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with these unique fields already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.status(500).json({ error: 'Internal server error' });
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { notFoundHandler, errorHandler, ApiError };
