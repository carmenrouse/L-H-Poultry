const prisma = require('../lib/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { computeReceipt } = require('./receivingMath');

const RECEIVABLE_STATUSES = ['SUBMITTED', 'PARTIALLY_RECEIVED'];

/**
 * Receives quantities against a purchase order's line items.
 * - Increments Product.quantityOnHand for each line received.
 * - Writes one InventoryAdjustment per line for the audit trail.
 * - Flags cost variance when the received unit cost differs from the PO unit cost.
 * - Recomputes PO status: SUBMITTED -> PARTIALLY_RECEIVED -> RECEIVED.
 */
async function receivePurchaseOrder({ businessId, purchaseOrderId, userId, lines }) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, businessId },
    include: { lineItems: true },
  });
  if (!po) throw new ApiError(404, 'Purchase order not found');
  if (!RECEIVABLE_STATUSES.includes(po.status)) {
    throw new ApiError(400, `Cannot receive against a purchase order in status ${po.status}`);
  }

  const { updates, variances, newStatus } = computeReceipt(po.lineItems, lines, po.status);

  const result = await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.purchaseOrderLineItem.update({
        where: { id: update.lineItemId },
        data: {
          quantityReceived: { increment: update.quantityDelta },
          receivedUnitCost: update.hasVariance ? update.receivedUnitCost : undefined,
        },
      });

      await tx.product.update({
        where: { id: update.productId },
        data: { quantityOnHand: { increment: update.quantityDelta } },
      });

      await tx.inventoryAdjustment.create({
        data: {
          businessId,
          productId: update.productId,
          delta: update.quantityDelta,
          reason: 'PO_RECEIPT',
          purchaseOrderId: po.id,
          userId,
          note: update.hasVariance
            ? `Received at $${update.receivedUnitCost} vs PO cost expected`
            : undefined,
        },
      });
    }

    const updatedPo = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: newStatus,
        receivedAt: newStatus === 'RECEIVED' ? new Date() : po.receivedAt,
        receivedById: newStatus === 'RECEIVED' ? userId : po.receivedById,
      },
      include: { lineItems: { include: { product: true } }, supplier: true },
    });

    return updatedPo;
  });

  return { purchaseOrder: result, variances };
}

module.exports = { receivePurchaseOrder, RECEIVABLE_STATUSES };
