const mockAdapter = require('./mockAdapter');
const textractAdapter = require('./textractAdapter');
const documentAiAdapter = require('./documentAiAdapter');

// Pluggable OCR/document-parsing adapter, selected the same way the web-export
// adapter is: one interface (extract), swap the implementation via env config.
const ADAPTERS = {
  mock: mockAdapter,
  textract: textractAdapter,
  documentai: documentAiAdapter,
};

function getOcrAdapter() {
  const provider = process.env.OCR_PROVIDER || 'mock';
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Unknown OCR_PROVIDER "${provider}"`);
  return adapter;
}

module.exports = { getOcrAdapter, ADAPTERS };
