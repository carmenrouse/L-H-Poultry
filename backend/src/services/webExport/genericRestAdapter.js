const fetch = require('node-fetch');

// Internal Product fields that a business can map into an external API's JSON shape.
const MAPPABLE_FIELDS = ['sku', 'name', 'description', 'price', 'cost', 'quantityOnHand', 'images', 'category', 'barcode'];

/**
 * fieldMapping shape: { "<externalFieldName>": "<internalProductField>", ... }
 * e.g. { "title": "name", "stock_quantity": "quantityOnHand", "sku": "sku" }
 */
function applyFieldMapping(product, fieldMapping) {
  const body = {};
  for (const [externalField, internalField] of Object.entries(fieldMapping)) {
    if (!MAPPABLE_FIELDS.includes(internalField)) continue;
    let value = product[internalField];
    if (value !== null && typeof value === 'object' && value.toFixed) value = Number(value); // Decimal -> number
    body[externalField] = value;
  }
  return body;
}

function buildAuthHeader(config) {
  if (config.authType === 'apiKey') {
    return { [config.authHeaderName || 'X-API-Key']: config.authToken };
  }
  // default: bearer token
  return { [config.authHeaderName || 'Authorization']: `Bearer ${config.authToken}` };
}

/**
 * Generic outbound REST adapter: POSTs to create a new external listing, or
 * PUTs to `${baseUrl}/${externalId}` to update an existing one. Designed so a
 * platform-specific adapter (Shopify, WooCommerce, ...) can implement the same
 * push(config, product, listing) contract without touching the core data model.
 */
async function push(config, product, listing) {
  const body = applyFieldMapping(product, config.fieldMapping);
  const headers = { 'Content-Type': 'application/json', ...buildAuthHeader(config) };
  const isUpdate = Boolean(listing && listing.externalId);
  const url = isUpdate ? `${config.baseUrl.replace(/\/$/, '')}/${listing.externalId}` : config.baseUrl;

  try {
    const response = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON response body; keep raw text for error surfacing.
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 500)}` };
    }

    const externalId = (json && (json.id || json.externalId)) || (listing && listing.externalId) || null;
    return { success: true, externalId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { push, applyFieldMapping, MAPPABLE_FIELDS };
