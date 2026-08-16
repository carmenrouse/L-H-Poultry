const { ApiError } = require('../middleware/errorHandler');

/**
 * Pure calculation for receiving against a PO's line items — no I/O, so it's
 * unit-testable without a database. Given the PO's current line items and the
 * quantities/costs being received now, returns per-line updates, cost
 * variances, and the PO's new status.
 *
 * @param {Array<{id, quantityOrdered, quantityReceived, unitCost}>} lineItems current PO line items
 * @param {Array<{lineItemId, quantityReceived, unitCost?}>} receiveLines quantities being received now
 * @param {string} currentStatus current PurchaseOrder.status
 */
function computeReceipt(lineItems, receiveLines, currentStatus) {
  const lineItemsById = new Map(lineItems.map((li) => [li.id, li]));

  for (const line of receiveLines) {
    const lineItem = lineItemsById.get(line.lineItemId);
    if (!lineItem) throw new ApiError(400, `Line item ${line.lineItemId} does not belong to this purchase order`);
    const remaining = lineItem.quantityOrdered - lineItem.quantityReceived;
    if (line.quantityReceived > remaining) {
      throw new ApiError(
        400,
        `Cannot receive ${line.quantityReceived} for line ${line.lineItemId}; only ${remaining} remain`
      );
    }
    if (line.quantityReceived <= 0) {
      throw new ApiError(400, `Quantity received for line ${line.lineItemId} must be positive`);
    }
  }

  const updates = [];
  const variances = [];

  for (const line of receiveLines) {
    const lineItem = lineItemsById.get(line.lineItemId);
    const receivedUnitCost = line.unitCost !== undefined ? Number(line.unitCost) : Number(lineItem.unitCost);
    const hasVariance = receivedUnitCost !== Number(lineItem.unitCost);
    if (hasVariance) {
      variances.push({
        lineItemId: lineItem.id,
        productId: lineItem.productId,
        expectedUnitCost: Number(lineItem.unitCost),
        receivedUnitCost,
      });
    }
    updates.push({
      lineItemId: lineItem.id,
      productId: lineItem.productId,
      quantityDelta: line.quantityReceived,
      newQuantityReceived: lineItem.quantityReceived + line.quantityReceived,
      hasVariance,
      receivedUnitCost,
    });
  }

  const receivedNowByLineId = new Map(updates.map((u) => [u.lineItemId, u.newQuantityReceived]));
  const projected = lineItems.map((li) => ({
    ...li,
    quantityReceived: receivedNowByLineId.get(li.id) ?? li.quantityReceived,
  }));

  const allReceived = projected.every((li) => li.quantityReceived >= li.quantityOrdered);
  const anyReceived = projected.some((li) => li.quantityReceived > 0);
  const newStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : currentStatus;

  return { updates, variances, newStatus };
}

module.exports = { computeReceipt };
