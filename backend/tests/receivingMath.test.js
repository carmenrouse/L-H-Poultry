const { computeReceipt } = require('../src/services/receivingMath');

describe('computeReceipt (PO receiving math)', () => {
  const baseLineItems = [
    { id: 'li-1', productId: 'prod-1', quantityOrdered: 10, quantityReceived: 0, unitCost: 2.5 },
    { id: 'li-2', productId: 'prod-2', quantityOrdered: 5, quantityReceived: 0, unitCost: 12.0 },
  ];

  test('partial receipt marks PO PARTIALLY_RECEIVED and computes deltas', () => {
    const { updates, newStatus, variances } = computeReceipt(
      baseLineItems,
      [{ lineItemId: 'li-1', quantityReceived: 4 }],
      'SUBMITTED'
    );
    expect(updates).toEqual([
      {
        lineItemId: 'li-1',
        productId: 'prod-1',
        quantityDelta: 4,
        newQuantityReceived: 4,
        hasVariance: false,
        receivedUnitCost: 2.5,
      },
    ]);
    expect(newStatus).toBe('PARTIALLY_RECEIVED');
    expect(variances).toEqual([]);
  });

  test('receiving all lines in full marks PO RECEIVED', () => {
    const { newStatus } = computeReceipt(
      baseLineItems,
      [
        { lineItemId: 'li-1', quantityReceived: 10 },
        { lineItemId: 'li-2', quantityReceived: 5 },
      ],
      'SUBMITTED'
    );
    expect(newStatus).toBe('RECEIVED');
  });

  test('receiving remaining quantity across two receipts completes the PO', () => {
    const afterFirst = [
      { id: 'li-1', productId: 'prod-1', quantityOrdered: 10, quantityReceived: 4, unitCost: 2.5 },
      { id: 'li-2', productId: 'prod-2', quantityOrdered: 5, quantityReceived: 5, unitCost: 12.0 },
    ];
    const { newStatus, updates } = computeReceipt(
      afterFirst,
      [{ lineItemId: 'li-1', quantityReceived: 6 }],
      'PARTIALLY_RECEIVED'
    );
    expect(updates[0].newQuantityReceived).toBe(10);
    expect(newStatus).toBe('RECEIVED');
  });

  test('flags cost variance when received unit cost differs from PO cost', () => {
    const { variances, updates } = computeReceipt(
      baseLineItems,
      [{ lineItemId: 'li-1', quantityReceived: 10, unitCost: 3.0 }],
      'SUBMITTED'
    );
    expect(variances).toEqual([
      { lineItemId: 'li-1', productId: 'prod-1', expectedUnitCost: 2.5, receivedUnitCost: 3.0 },
    ]);
    expect(updates[0].hasVariance).toBe(true);
  });

  test('rejects receiving more than the remaining quantity', () => {
    expect(() =>
      computeReceipt(baseLineItems, [{ lineItemId: 'li-1', quantityReceived: 11 }], 'SUBMITTED')
    ).toThrow(/only 10 remain/);
  });

  test('rejects a non-positive quantity', () => {
    expect(() =>
      computeReceipt(baseLineItems, [{ lineItemId: 'li-1', quantityReceived: 0 }], 'SUBMITTED')
    ).toThrow(/must be positive/);
  });

  test('rejects a line item that does not belong to the PO', () => {
    expect(() =>
      computeReceipt(baseLineItems, [{ lineItemId: 'unknown', quantityReceived: 1 }], 'SUBMITTED')
    ).toThrow(/does not belong/);
  });
});
