/**
 * Google Document AI adapter for parsing purchase orders / invoices.
 * Requires: npm install @google-cloud/documentai
 * Env: GOOGLE_DOCUMENT_AI_PROJECT_ID, GOOGLE_DOCUMENT_AI_LOCATION,
 *      GOOGLE_DOCUMENT_AI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS
 */
async function extract(fileBuffer, mimeType) {
  let DocumentProcessorServiceClient;
  try {
    ({ DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1);
  } catch (err) {
    throw new Error('OCR_PROVIDER=documentai requires "npm install @google-cloud/documentai"');
  }

  const client = new DocumentProcessorServiceClient();
  const name = client.processorPath(
    process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID,
    process.env.GOOGLE_DOCUMENT_AI_LOCATION,
    process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
  );

  const [result] = await client.processDocument({
    name,
    rawDocument: { content: fileBuffer, mimeType: mimeType || 'application/pdf' },
  });

  const doc = result.document;
  const header = { supplierName: null, poNumber: null, date: null };
  const lineItems = [];

  for (const entity of doc.entities || []) {
    if (entity.type === 'supplier_name') header.supplierName = entity.mentionText;
    if (entity.type === 'purchase_order_id' || entity.type === 'invoice_id') header.poNumber = entity.mentionText;
    if (entity.type === 'purchase_order_date' || entity.type === 'invoice_date') header.date = entity.mentionText;
    if (entity.type === 'line_item') {
      const props = {};
      for (const p of entity.properties || []) props[p.type] = p.mentionText;
      lineItems.push({
        description: props.line_item_description || entity.mentionText || 'Unknown item',
        quantity: Number(props.line_item_quantity) || 1,
        unitCost: Number(props.line_item_unit_price) || 0,
      });
    }
  }

  return { provider: 'documentai', header, lineItems, raw: doc };
}

module.exports = { extract };
