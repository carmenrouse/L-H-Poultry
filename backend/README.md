# L&H Poultry POS — Backend API

Node.js + Express REST API backing the mobile POS app. PostgreSQL via Prisma. JWT auth with `OWNER` / `MANAGER` / `CASHIER` roles. Multi-tenant: every table (except `Business` itself) is scoped by `businessId`, and every query filters on the authenticated user's `businessId` — one business's data is never returned to another.

## Setup

```bash
cp .env.example .env      # edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev --name init   # creates the DB schema
npm run seed                          # sample business/users/suppliers/products
npm run dev                           # http://localhost:4000
```

Requires a running PostgreSQL instance matching `DATABASE_URL`.

Seeded logins (password `password123` for all):
- `owner@lhpoultry.test` — OWNER
- `manager@lhpoultry.test` — MANAGER
- `cashier@lhpoultry.test` — CASHIER

## Role permissions

| Action | Cashier | Manager | Owner |
|---|---|---|---|
| Sell (POS checkout) | ✅ | ✅ | ✅ |
| View products / sales history | ✅ | ✅ | ✅ |
| Create/edit Products, Suppliers | | ✅ | ✅ |
| Create/submit/cancel/receive POs | | ✅ | ✅ |
| Scan-to-PO | | ✅ | ✅ |
| Manage users | | | ✅ |
| Manage web export config + push | | | ✅ |

Enforced server-side via `requireRole(minRole)` — a role hierarchy (`CASHIER < MANAGER < OWNER`), never trusted from the client.

## Auth

All routes below `/api/*` except `/api/auth/*` require `Authorization: Bearer <token>`.

- `POST /api/auth/register-business` — creates a new `Business` + its first `OWNER` user. `{ businessName, ownerName, email, password }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET /api/auth/me`

## Products

- `GET /api/products?search=&category=&barcode=`
- `GET /api/products/:id`
- `POST /api/products` (Manager+) — `{ sku, name, description?, cost?, price?, quantityOnHand?, reorderPoint?, category?, images?, barcode? }`
- `PATCH /api/products/:id` (Manager+) — cannot set `quantityOnHand` directly (see `/adjust`)
- `POST /api/products/:id/adjust` (Manager+) — manual stock correction, `{ delta, note? }`, writes an `InventoryAdjustment`
- `DELETE /api/products/:id` (Manager+) — soft delete (`active: false`)

## Suppliers

- `GET /api/suppliers`, `GET /api/suppliers/:id`
- `POST /api/suppliers` / `PATCH /api/suppliers/:id` / `DELETE /api/suppliers/:id` (Manager+)

## Purchase Orders

- `GET /api/purchase-orders?status=&supplierId=`
- `GET /api/purchase-orders/:id`
- `POST /api/purchase-orders` (Manager+) — `{ supplierId, poNumber?, expectedDate?, notes?, lineItems: [{ productId, quantityOrdered, unitCost }], submit? }`. Also accepts `source: "SCANNED"`, `scanAttachmentUrl`, `scanRawData` — the scan-to-PO flow (below) posts here too; scanning is just an alternate entry point into the same model.
- `PATCH /api/purchase-orders/:id` (Manager+) — only while `DRAFT`/`SUBMITTED`
- `POST /api/purchase-orders/:id/submit` (Manager+) — `DRAFT` → `SUBMITTED`
- `POST /api/purchase-orders/:id/cancel` (Manager+) — only while `DRAFT`/`SUBMITTED`
- `POST /api/purchase-orders/:id/receive` (Manager+) — `{ lines: [{ lineItemId, quantityReceived, unitCost? }] }`. Increments `Product.quantityOnHand`, writes one `InventoryAdjustment` (`reason: PO_RECEIPT`) per line, flags cost variance when `unitCost` differs from the PO's expected cost, and auto-transitions status `SUBMITTED → PARTIALLY_RECEIVED → RECEIVED`.

## Scan-to-PO (OCR)

- `POST /api/scan/purchase-order` (Manager+) — multipart upload, field name `file` (jpeg/png/heic/pdf, ≤15MB). Runs the configured OCR adapter, fuzzy-matches each extracted line to existing products, fuzzy-matches the extracted supplier name to existing suppliers, and returns an **unsaved** draft for the mobile review screen:
  ```json
  {
    "scanAttachmentUrl": "/uploads/<uuid>.jpg",
    "header": { "supplierName": "...", "poNumber": "...", "date": "...", "matchedSupplierId": "..." },
    "lineItems": [{ "description": "...", "quantity": 10, "unitCost": 4.5, "matchedProductId": "...", "confidence": 0.82, "suggestions": [...] }]
  }
  ```
  The client edits this draft, then calls `POST /api/purchase-orders` with the corrected `lineItems`, `scanAttachmentUrl`, `scanRawData: rawOcrData`, and `source: "SCANNED"` to actually create the PO.

  OCR provider is pluggable via `OCR_PROVIDER` env var: `mock` (default, no cloud creds needed — for local dev), `textract` (AWS Textract `AnalyzeExpense`, needs `npm install @aws-sdk/client-textract`), `documentai` (Google Document AI, needs `npm install @google-cloud/documentai`). See `src/services/ocr/`.

## Sales (POS)

- `POST /api/sales` — `{ paymentMethod: "CASH"|"CARD", lineItems: [{ productId, quantity }] }`. Prices each line at the product's current price, applies `Business.taxRate`, decrements `Product.quantityOnHand`, writes one `InventoryAdjustment` (`reason: SALE`) per line. Blocks the sale if it would take any product below zero stock, unless `Business.allowNegativeStock` is `true` (in which case it succeeds with `warnings`).
- `GET /api/sales?from=&to=&staffId=` — history
- `GET /api/sales/:id` — full detail for a receipt view

## Web export (generic REST adapter)

- `GET /api/web-export/configs`, `POST /api/web-export/configs`, `PATCH /api/web-export/configs/:id`, `DELETE /api/web-export/configs/:id` (Owner) — `{ name, baseUrl, authType: "bearer"|"apiKey", authHeaderName?, authToken, fieldMapping: { "<externalField>": "<internalProductField>" } }`. `authToken` is redacted in responses.
- `GET /api/web-export/listings?productId=` (Owner)
- `POST /api/web-export/push` (Owner) — `{ productId, configId }`
- `POST /api/web-export/push-bulk` (Owner) — `{ productIds: [...], configId }`

The adapter (`src/services/webExport/genericRestAdapter.js`) maps `Product` fields into the external JSON shape per `fieldMapping`, POSTs to `baseUrl` to create a listing or PUTs to `baseUrl/:externalId` to update one, and records `syncStatus`/`lastSyncedAt`/`lastError` on the `WebListing`. It's a plain `push(config, product, listing)` function — a Shopify/WooCommerce adapter can implement the same contract later without touching the data model.

## Users

- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` (Owner)

## Testing

```bash
npm test
```

`tests/receivingMath.test.js`, `tests/checkoutMath.test.js`, and `tests/webExportMapping.test.js` unit-test the pure calculation cores of PO receiving, sale checkout, and web-export field mapping (`src/services/receivingMath.js`, `checkoutMath.js`, `webExport/genericRestAdapter.js`) without touching a database. The route/service layer (`purchaseOrders.js` + `receiving.js`, `sales.js` + `checkout.js`) wraps these pure functions in Prisma transactions.
