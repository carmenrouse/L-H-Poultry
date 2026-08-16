const express = require('express');
const { body } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!supplier) throw new ApiError(404, 'Supplier not found');
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRole('MANAGER'),
  [
    body('name').isString().trim().notEmpty(),
    body('contactName').optional().isString(),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('phone').optional().isString(),
    body('address').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, contactName, email, phone, address } = req.body;
      const supplier = await prisma.supplier.create({
        data: { businessId: req.user.businessId, name, contactName, email, phone, address },
      });
      res.status(201).json(supplier);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRole('MANAGER'),
  [
    body('name').optional().isString().trim().notEmpty(),
    body('contactName').optional().isString(),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('phone').optional().isString(),
    body('address').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await prisma.supplier.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new ApiError(404, 'Supplier not found');
      const supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: req.body,
      });
      res.json(supplier);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) throw new ApiError(404, 'Supplier not found');
    await prisma.supplier.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
