const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const scanRoutes = require('./routes/scan');
const saleRoutes = require('./routes/sales');
const webExportRoutes = require('./routes/webExport');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
// Scanned PO/invoice attachments (dev/local storage; swap for S3/GCS in production).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/web-export', webExportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
