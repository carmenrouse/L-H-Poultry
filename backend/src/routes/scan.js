const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { getOcrAdapter } = require('../services/ocr');
const { matchProduct, similarity } = require('../services/productMatcher');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// Capture/import a paper PO or invoice, OCR it, and return an editable draft
// (product-matched line items) for the mobile review screen. Nothing is
// persisted as a PurchaseOrder here — that happens via the normal
// POST /api/purchase-orders call once the user confirms the review screen.
router.post('/purchase-order', requireRole('MANAGER'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'No file uploaded (field name "file")');

    const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : req.file.mimetype.split('/')[1];
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    const scanAttachmentUrl = `/uploads/${filename}`;

    const adapter = getOcrAdapter();
    const extraction = await adapter.extract(req.file.buffer, req.file.mimetype);

    const [products, suppliers] = await Promise.all([
      prisma.product.findMany({ where: { businessId: req.user.businessId, active: true } }),
      prisma.supplier.findMany({ where: { businessId: req.user.businessId } }),
    ]);

    const lineItems = extraction.lineItems.map((li) => {
      const match = matchProduct(li.description, products);
      return {
        description: li.description,
        quantity: li.quantity,
        unitCost: li.unitCost,
        matchedProductId: match.matchedProductId,
        confidence: match.confidence,
        suggestions: match.suggestions,
      };
    });

    let matchedSupplierId = null;
    if (extraction.header.supplierName && suppliers.length) {
      const ranked = suppliers
        .map((s) => ({ id: s.id, score: similarity(extraction.header.supplierName, s.name) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0] && ranked[0].score >= 0.55) matchedSupplierId = ranked[0].id;
    }

    res.status(201).json({
      scanAttachmentUrl,
      provider: extraction.provider,
      header: { ...extraction.header, matchedSupplierId },
      lineItems,
      rawOcrData: extraction.raw,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
