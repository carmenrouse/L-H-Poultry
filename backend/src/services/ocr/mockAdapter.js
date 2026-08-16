/**
 * Mock OCR adapter for local development and tests — no cloud credentials required.
 * Returns a plausible extraction so the scan-to-PO flow can be exercised end to end.
 */
async function extract(_fileBuffer, _mimeType) {
  return {
    provider: 'mock',
    header: {
      supplierName: 'Sample Supplier Co.',
      poNumber: `SCAN-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
    },
    lineItems: [
      { description: 'Sample Product A', quantity: 10, unitCost: 4.5 },
      { description: 'Sample Product B', quantity: 5, unitCost: 12.0 },
    ],
    raw: { note: 'mock adapter output, replace OCR_PROVIDER to use a real provider' },
  };
}

module.exports = { extract };
