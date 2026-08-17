const prisma = require('../lib/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { computeSale } = require('./checkoutMath');

/**
 * Completes a sale: prices line items at current Product.price, applies the
 * business tax rate, decrements stock, and writes one InventoryAdjustment per
 * line for the audit trail. Stock going negative is blocked unless the
 * business has opted in via Business.allowNegativeStock.
 */
async function completeSale({ businessId, staffId, paymentMethod, lineItems }) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new ApiError(404, 'Business not found');

  const productIds = [...new Set(lineItems.map((li) => li.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, businessId } });
  if (products.length !== productIds.length) {
    throw new ApiError(400, 'One or more products are invalid for this business');
  }

  const { pricedLineItems, subtotal, taxTotal, total, warnings } = computeSale(
    products,
    lineItems,
    Number(business.taxRate),
    business.allowNegativeStock
  );

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        businessId,
        staffId,
        paymentMethod,
        subtotal,
        taxTotal,
        total,
        lineItems: { create: pricedLineItems },
      },
      include: { lineItems: { include: { product: true } } },
    });

    for (const li of pricedLineItems) {
      await tx.product.update({
        where: { id: li.productId },
        data: { quantityOnHand: { decrement: li.quantity } },
      });
      await tx.inventoryAdjustment.create({
        data: {
          businessId,
          productId: li.productId,
          delta: -li.quantity,
          reason: 'SALE',
          saleId: created.id,
          userId: staffId,
        },
      });
    }

    return created;
  });

  return { sale, warnings };
}

module.exports = { completeSale };
