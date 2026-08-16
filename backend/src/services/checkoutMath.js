const { ApiError } = require('../middleware/errorHandler');

/**
 * Pure calculation for a sale — no I/O, so it's unit-testable without a
 * database. Validates stock, prices each line at the product's current
 * price, and computes subtotal/tax/total.
 *
 * @param {Array<{id, name, price, quantityOnHand}>} products candidate products, keyed by id
 * @param {Array<{productId, quantity}>} lineItems requested sale lines
 * @param {number} taxRate business tax rate, e.g. 0.0725
 * @param {boolean} allowNegativeStock whether stock may go below zero
 */
function computeSale(products, lineItems, taxRate, allowNegativeStock) {
  const productsById = new Map(products.map((p) => [p.id, p]));
  const warnings = [];
  const stockDeltas = [];

  for (const li of lineItems) {
    const product = productsById.get(li.productId);
    if (!product) throw new ApiError(400, `Product ${li.productId} not found`);
    if (li.quantity <= 0) throw new ApiError(400, `Invalid quantity for product ${li.productId}`);

    const resultingQty = product.quantityOnHand - li.quantity;
    if (resultingQty < 0) {
      if (!allowNegativeStock) {
        throw new ApiError(
          400,
          `Insufficient stock for "${product.name}" (have ${product.quantityOnHand}, need ${li.quantity})`
        );
      }
      warnings.push(`Sold "${product.name}" below zero stock (now ${resultingQty})`);
    }
    stockDeltas.push({ productId: li.productId, delta: -li.quantity, resultingQty });
  }

  let subtotal = 0;
  const pricedLineItems = lineItems.map((li) => {
    const product = productsById.get(li.productId);
    const priceAtSale = Number(product.price);
    subtotal += priceAtSale * li.quantity;
    return { productId: li.productId, quantity: li.quantity, priceAtSale };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxTotal) * 100) / 100;

  return { pricedLineItems, subtotal, taxTotal, total, warnings, stockDeltas };
}

module.exports = { computeSale };
