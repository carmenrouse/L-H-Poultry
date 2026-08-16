const { applyFieldMapping, MAPPABLE_FIELDS } = require('../src/services/webExport/genericRestAdapter');

// Mimics a Prisma Decimal instance closely enough for applyFieldMapping's coercion.
class FakeDecimal {
  constructor(value) {
    this.value = value;
  }
  toFixed() {
    return this.value.toFixed(2);
  }
  valueOf() {
    return this.value;
  }
}

describe('applyFieldMapping (web export field mapping)', () => {
  const product = {
    id: 'prod-1',
    sku: 'EGG-DZ-LG',
    name: 'Large Eggs (Dozen)',
    description: 'Farm-fresh large eggs',
    price: new FakeDecimal(4.5),
    cost: new FakeDecimal(2.1),
    quantityOnHand: 120,
    images: ['https://example.com/egg.jpg'],
    category: 'Eggs',
    barcode: '049000028911',
  };

  test('maps internal fields to external field names per the configured template', () => {
    const mapping = {
      title: 'name',
      sku: 'sku',
      stock_quantity: 'quantityOnHand',
      retail_price: 'price',
      photos: 'images',
    };
    const body = applyFieldMapping(product, mapping);
    expect(body).toEqual({
      title: 'Large Eggs (Dozen)',
      sku: 'EGG-DZ-LG',
      stock_quantity: 120,
      retail_price: 4.5,
      photos: ['https://example.com/egg.jpg'],
    });
  });

  test('coerces Decimal-like values to plain numbers', () => {
    const body = applyFieldMapping(product, { cost: 'cost' });
    expect(typeof body.cost).toBe('number');
    expect(body.cost).toBeCloseTo(2.1, 2);
  });

  test('ignores mapping entries that target a non-mappable internal field', () => {
    const body = applyFieldMapping(product, { secret: 'passwordHash', title: 'name' });
    expect(body).toEqual({ title: 'Large Eggs (Dozen)' });
  });

  test('produces an empty body for an empty mapping', () => {
    expect(applyFieldMapping(product, {})).toEqual({});
  });

  test('MAPPABLE_FIELDS whitelist covers the fields product export needs', () => {
    expect(MAPPABLE_FIELDS).toEqual(
      expect.arrayContaining(['sku', 'name', 'description', 'price', 'quantityOnHand', 'images'])
    );
  });
});
