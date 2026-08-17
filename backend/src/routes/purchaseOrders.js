const express = require('express');
const { body, query } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');
const { receivePurchaseOrder } = require('../services/receiving');

const router = express.Router();

router.use(authenticate);

const EDITABLE_STATUSES = ['DRAFT', 'SUBMITTED'];

router.get(
  '/',
  [query('status').optional().isString(), query('supplierId').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const { status, supplierId } = req.query;
      const where = { businessId: req.user.businessId };
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;
      const pos = await prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, lineItems: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(pos);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:id', async (req, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true } },
        lineItems: { include: { product: true } },
        inventoryAdjustments: true,
      },
    });
    if (!po) throw new ApiError(404, 'Purchase order not found');
    res.json(po);
  } catch (err) {
    next(err);
  }
});

const lineItemValidators = [
  body('lineItems').isArray({ min: 1 }),
  body('lineItems.*.productId').isString().notEmpty(),
  body('lineItems.*.quantityOrdered').isInt({ min: 1 }),
  body('lineItems.*.unitCost').isFloat({ min: 0 }),
];

async function assertProductsBelongToBusiness(businessId, lineItems) {
  const ids = [...new Set(lineItems.map((li) => li.productId))];
  const count = await prisma.product.count({ where: { id: { in: ids }, businessId } });
  if (count !== ids.length) throw new ApiError(400, 'One or more products are invalid for this business');
}

router.post(
  '/',
  requireRole('MANAGER'),
  [
    body('supplierId').isString().notEmpty(),
    body('poNumber').optional().isString(),
    body('expectedDate').optional().isISO8601(),
    body('notes').optional().isString(),
    body('source').optional().isIn(['MANUAL', 'SCANNED']),
    body('scanAttachmentUrl').optional().isString(),
    body('scanRawData').optional(),
    body('submit').optional().isBoolean(),
    ...lineItemValidators,
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        supplierId, poNumber, expectedDate, notes, lineItems,
        source, scanAttachmentUrl, scanRawData, submit,
      } = req.body;

      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, businessId: req.user.businessId },
      });
      if (!supplier) throw new ApiError(400, 'Invalid supplier');
      await assertProductsBelongToBusiness(req.user.businessId, lineItems);

      const po = await prisma.purchaseOrder.create({
        data: {
          businessId: req.user.businessId,
          supplierId,
          poNumber,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          notes,
          source: source || 'MANUAL',
          scanAttachmentUrl,
          scanRawData,
          createdById: req.user.id,
          status: submit ? 'SUBMITTED' : 'DRAFT',
          submittedAt: submit ? new Date() : null,
          lineItems: {
            create: lineItems.map((li) => ({
              productId: li.productId,
              quantityOrdered: li.quantityOrdered,
              unitCost: li.unitCost,
            })),
          },
        },
        include: { lineItems: { include: { product: true } }, supplier: true },
      });
      res.status(201).json(po);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRole('MANAGER'),
  [
    body('supplierId').optional().isString().notEmpty(),
    body('poNumber').optional().isString(),
    body('expectedDate').optional().isISO8601(),
    body('notes').optional().isString(),
    body('lineItems').optional().isArray({ min: 1 }),
    body('lineItems.*.productId').optional().isString().notEmpty(),
    body('lineItems.*.quantityOrdered').optional().isInt({ min: 1 }),
    body('lineItems.*.unitCost').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await prisma.purchaseOrder.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new ApiError(404, 'Purchase order not found');
      if (!EDITABLE_STATUSES.includes(existing.status)) {
        throw new ApiError(400, `Cannot edit a purchase order in status ${existing.status}`);
      }

      const { supplierId, poNumber, expectedDate, notes, lineItems } = req.body;
      const data = {};
      if (supplierId !== undefined) data.supplierId = supplierId;
      if (poNumber !== undefined) data.poNumber = poNumber;
      if (expectedDate !== undefined) data.expectedDate = new Date(expectedDate);
      if (notes !== undefined) data.notes = notes;

      if (lineItems) {
        await assertProductsBelongToBusiness(req.user.businessId, lineItems);
        await prisma.purchaseOrderLineItem.deleteMany({ where: { purchaseOrderId: existing.id } });
        data.lineItems = {
          create: lineItems.map((li) => ({
            productId: li.productId,
            quantityOrdered: li.quantityOrdered,
            unitCost: li.unitCost,
          })),
        };
      }

      const po = await prisma.purchaseOrder.update({
        where: { id: existing.id },
        data,
        include: { lineItems: { include: { product: true } }, supplier: true },
      });
      res.json(po);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/submit', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) throw new ApiError(404, 'Purchase order not found');
    if (existing.status !== 'DRAFT') throw new ApiError(400, 'Only draft purchase orders can be submitted');
    const po = await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    res.json(po);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) throw new ApiError(404, 'Purchase order not found');
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ApiError(400, `Cannot cancel a purchase order in status ${existing.status}`);
    }
    const po = await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
    });
    res.json(po);
  } catch (err) {
    next(err);
  }
});

// Receive full or partial quantities against a submitted/partially-received PO.
router.post(
  '/:id/receive',
  requireRole('MANAGER'),
  [
    body('lines').isArray({ min: 1 }),
    body('lines.*.lineItemId').isString().notEmpty(),
    body('lines.*.quantityReceived').isInt({ min: 1 }),
    body('lines.*.unitCost').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await receivePurchaseOrder({
        businessId: req.user.businessId,
        purchaseOrderId: req.params.id,
        userId: req.user.id,
        lines: req.body.lines,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
