const express = require('express');
const { body } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { push } = require('../services/webExport/genericRestAdapter');

const router = express.Router();
router.use(authenticate);

function redact(config) {
  return { ...config, authToken: config.authToken ? '••••••••' : '' };
}

router.get('/configs', requireRole('OWNER'), async (req, res, next) => {
  try {
    const configs = await prisma.webExportConfig.findMany({ where: { businessId: req.user.businessId } });
    res.json(configs.map(redact));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/configs',
  requireRole('OWNER'),
  [
    body('name').isString().trim().notEmpty(),
    body('baseUrl').isURL({ require_tld: false }),
    body('authType').optional().isIn(['bearer', 'apiKey']),
    body('authHeaderName').optional().isString(),
    body('authToken').isString().notEmpty(),
    body('fieldMapping').isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, baseUrl, authType, authHeaderName, authToken, fieldMapping } = req.body;
      const config = await prisma.webExportConfig.create({
        data: {
          businessId: req.user.businessId,
          name,
          baseUrl,
          authType: authType || 'bearer',
          authHeaderName: authHeaderName || (authType === 'apiKey' ? 'X-API-Key' : 'Authorization'),
          authToken,
          fieldMapping,
        },
      });
      res.status(201).json(redact(config));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/configs/:id',
  requireRole('OWNER'),
  [
    body('name').optional().isString().trim().notEmpty(),
    body('baseUrl').optional().isURL({ require_tld: false }),
    body('authType').optional().isIn(['bearer', 'apiKey']),
    body('authHeaderName').optional().isString(),
    body('authToken').optional().isString().notEmpty(),
    body('fieldMapping').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await prisma.webExportConfig.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new ApiError(404, 'Web export config not found');
      const config = await prisma.webExportConfig.update({ where: { id: existing.id }, data: req.body });
      res.json(redact(config));
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/configs/:id', requireRole('OWNER'), async (req, res, next) => {
  try {
    const existing = await prisma.webExportConfig.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) throw new ApiError(404, 'Web export config not found');
    await prisma.webExportConfig.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/listings', requireRole('OWNER'), async (req, res, next) => {
  try {
    const where = { product: { businessId: req.user.businessId } };
    if (req.query.productId) where.productId = req.query.productId;
    const listings = await prisma.webListing.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true } }, config: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

async function pushOne({ businessId, productId, configId }) {
  const [product, config] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, businessId } }),
    prisma.webExportConfig.findFirst({ where: { id: configId, businessId } }),
  ]);
  if (!product) throw new ApiError(404, `Product ${productId} not found`);
  if (!config) throw new ApiError(404, `Web export config ${configId} not found`);

  let listing = await prisma.webListing.findUnique({
    where: { productId_configId: { productId, configId } },
  });
  if (!listing) {
    listing = await prisma.webListing.create({
      data: { productId, configId, syncStatus: 'PENDING' },
    });
  }

  const result = await push(config, product, listing);

  return prisma.webListing.update({
    where: { id: listing.id },
    data: {
      syncStatus: result.success ? 'SYNCED' : 'ERROR',
      lastSyncedAt: result.success ? new Date() : listing.lastSyncedAt,
      lastError: result.success ? null : result.error,
      externalId: result.externalId ?? listing.externalId,
    },
  });
}

router.post(
  '/push',
  requireRole('OWNER'),
  [body('productId').isString().notEmpty(), body('configId').isString().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const listing = await pushOne({
        businessId: req.user.businessId,
        productId: req.body.productId,
        configId: req.body.configId,
      });
      res.json(listing);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/push-bulk',
  requireRole('OWNER'),
  [body('productIds').isArray({ min: 1 }), body('configId').isString().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const results = [];
      for (const productId of req.body.productIds) {
        try {
          const listing = await pushOne({ businessId: req.user.businessId, productId, configId: req.body.configId });
          results.push(listing);
        } catch (err) {
          results.push({ productId, error: err.message });
        }
      }
      res.json(results);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
