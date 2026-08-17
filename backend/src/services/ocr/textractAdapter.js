/**
 * AWS Textract adapter (AnalyzeExpense) for parsing purchase orders / invoices.
 * Requires: npm install @aws-sdk/client-textract
 * Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
async function extract(fileBuffer, _mimeType) {
  let TextractClient, AnalyzeExpenseCommand;
  try {
    ({ TextractClient, AnalyzeExpenseCommand } = require('@aws-sdk/client-textract'));
  } catch (err) {
    throw new Error('OCR_PROVIDER=textract requires "npm install @aws-sdk/client-textract"');
  }

  const client = new TextractClient({ region: process.env.AWS_REGION });
  const command = new AnalyzeExpenseCommand({ Document: { Bytes: fileBuffer } });
  const response = await client.send(command);

  const doc = response.ExpenseDocuments && response.ExpenseDocuments[0];
  const header = { supplierName: null, poNumber: null, date: null };
  const lineItems = [];

  if (doc) {
    for (const field of doc.SummaryFields || []) {
      const type = field.Type && field.Type.Text;
      const value = field.ValueDetection && field.ValueDetection.Text;
      if (type === 'VENDOR_NAME') header.supplierName = value;
      if (type === 'INVOICE_RECEIPT_ID' || type === 'PO_NUMBER') header.poNumber = value;
      if (type === 'INVOICE_RECEIPT_DATE') header.date = value;
    }

    for (const group of doc.LineItemGroups || []) {
      for (const item of group.LineItems || []) {
        const fields = {};
        for (const f of item.LineItemExpenseFields || []) {
          const type = f.Type && f.Type.Text;
          const value = f.ValueDetection && f.ValueDetection.Text;
          if (type) fields[type] = value;
        }
        lineItems.push({
          description: fields.ITEM || fields.DESCRIPTION || 'Unknown item',
          quantity: Number(fields.QUANTITY) || 1,
          unitCost: Number(fields.UNIT_PRICE || fields.PRICE) || 0,
        });
      }
    }
  }

  return { provider: 'textract', header, lineItems, raw: response };
}

module.exports = { extract };
