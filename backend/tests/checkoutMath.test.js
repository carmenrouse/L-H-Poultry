const { computeSale } = require('../src/services/checkoutMath');

describe('computeSale (sale inventory decrement math)', () => {
  const products = [
    { id: 'prod-1', name: 'Large Eggs (Dozen)', price: 4.5, quantityOnHand: 10 },
    { id: 'prod-2', name: 'Whole Chicken', price: 9.99, quantityOnHand: 3 },
  ];

  test('computes subtotal, tax, and total for a mixed cart', () => {
    const result = computeSale(
      products,
      [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ],
      0.0725,
      false
    );
    expect(result.subtotal).toBeCloseTo(18.99, 2);
    expect(result.taxTotal).toBeCloseTo(1.38, 2);
    expect(result.total).toBeCloseTo(20.37, 2);
    expect(result.stockDeltas).toEqual([
      { productId: 'prod-1', delta: -2, resultingQty: 8 },
      { productId: 'prod-2', delta: -1, resultingQty: 2 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  test('blocks a sale that would take stock negative by default', () => {
    expect(() =>
      computeSale(products, [{ productId: 'prod-2', quantity: 5 }], 0.0725, false)
    ).toThrow(/Insufficient stock/);
  });

  test('allows negative stock with a warning when the business opts in', () => {
    const result = computeSale(products, [{ productId: 'prod-2', quantity: 5 }], 0.0725, true);
    expect(result.stockDeltas[0].resultingQty).toBe(-2);
    expect(result.warnings[0]).toMatch(/below zero stock/);
  });

  test('rejects a non-positive quantity', () => {
    expect(() =>
      computeSale(products, [{ productId: 'prod-1', quantity: 0 }], 0.0725, false)
    ).toThrow(/Invalid quantity/);
  });

  test('rejects an unknown product', () => {
    expect(() =>
      computeSale(products, [{ productId: 'unknown', quantity: 1 }], 0.0725, false)
    ).toThrow(/not found/);
  });

  test('prices each line at the product\'s current price, not a stale price', () => {
    const result = computeSale(products, [{ productId: 'prod-1', quantity: 3 }], 0, false);
    expect(result.pricedLineItems).toEqual([{ productId: 'prod-1', quantity: 3, priceAtSale: 4.5 }]);
  });
});
