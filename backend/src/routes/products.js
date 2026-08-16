const express = require('express');
const { body, query } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

// List/search products. Cashiers need this for POS lookup too.
router.get(
  '/',
  [query('search').optional().isString(), query('category').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const { search, category, barcode } = req.query;
      const where = { businessId: req.user.businessId };
      if (category) where.category = category;
      if (barcode) where.barcode = barcode;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }
      const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
      res.json(products);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!product) throw new ApiError(404, 'Product not found');
    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRole('MANAGER'),
  [
    body('sku').isString().trim().notEmpty(),
    body('name').isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('cost').optional().isFloat({ min: 0 }),
    body('price').optional().isFloat({ min: 0 }),
    body('quantityOnHand').optional().isInt({ min: 0 }),
    body('reorderPoint').optional().isInt({ min: 0 }),
    body('category').optional().isString(),
    body('images').optional().isArray(),
    body('barcode').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        sku, name, description, cost, price,
        quantityOnHand, reorderPoint, category, images, barcode,
      } = req.body;
      const product = await prisma.product.create({
        data: {
          businessId: req.user.businessId,
          sku,
          name,
          description,
          cost: cost ?? 0,
          price: price ?? 0,
          quantityOnHand: quantityOnHand ?? 0,
          reorderPoint: reorderPoint ?? 0,
          category,
          images: images ?? [],
          barcode,
        },
      });
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRole('MANAGER'),
  [
    body('sku').optional().isString().trim().notEmpty(),
    body('name').optional().isString().trim().notEmpty(),
    body('description').optional().isString(),
    body('cost').optional().isFloat({ min: 0 }),
    body('price').optional().isFloat({ min: 0 }),
    body('reorderPoint').optional().isInt({ min: 0 }),
    body('category').optional().isString(),
    body('images').optional().isArray(),
    body('barcode').optional().isString(),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await prisma.product.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new ApiError(404, 'Product not found');
      // quantityOnHand must only change via InventoryAdjustment-producing endpoints.
      const { quantityOnHand, ...data } = req.body;
      const product = await prisma.product.update({ where: { id: existing.id }, data });
      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

// Manual stock correction — the one place outside PO receiving/sales that quantityOnHand may change.
router.post(
  '/:id/adjust',
  requireRole('MANAGER'),
  [body('delta').isInt(), body('note').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const { delta, note } = req.body;
      const product = await prisma.product.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!product) throw new ApiError(404, 'Product not found');

      const newQty = product.quantityOnHand + delta;
      if (newQty < 0) throw new ApiError(400, 'Adjustment would result in negative stock');

      const [updated] = await prisma.$transaction([
        prisma.product.update({ where: { id: product.id }, data: { quantityOnHand: newQty } }),
        prisma.inventoryAdjustment.create({
          data: {
            businessId: req.user.businessId,
            productId: product.id,
            delta,
            reason: 'MANUAL_CORRECTION',
            userId: req.user.id,
            note,
          },
        }),
      ]);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) throw new ApiError(404, 'Product not found');
    await prisma.product.update({ where: { id: existing.id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
