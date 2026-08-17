const express = require('express');
const { body, query } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { completeSale } = require('../services/checkout');

const router = express.Router();
router.use(authenticate);

router.post(
  '/',
  [
    body('paymentMethod').isIn(['CASH', 'CARD']),
    body('lineItems').isArray({ min: 1 }),
    body('lineItems.*.productId').isString().notEmpty(),
    body('lineItems.*.quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { paymentMethod, lineItems } = req.body;
      const result = await completeSale({
        businessId: req.user.businessId,
        staffId: req.user.id,
        paymentMethod,
        lineItems,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601(), query('staffId').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const { from, to, staffId } = req.query;
      const where = { businessId: req.user.businessId };
      if (staffId) where.staffId = staffId;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }
      const sales = await prisma.sale.findMany({
        where,
        include: { staff: { select: { id: true, name: true } }, lineItems: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(sales);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
      include: {
        staff: { select: { id: true, name: true } },
        lineItems: { include: { product: true } },
      },
    });
    if (!sale) throw new ApiError(404, 'Sale not found');
    res.json(sale);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
