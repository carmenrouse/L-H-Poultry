# L&H Poultry POS

A full-stack mobile point-of-sale application for small retail businesses: multi-tenant, multi-user (Owner/Manager/Cashier), with purchase ordering (manual and scan-to-PO via OCR), inventory receiving, checkout with barcode scanning, and a generic REST adapter for pushing products to external web listings.

- **`backend/`** — Node.js/Express REST API, PostgreSQL via Prisma, JWT auth. See `backend/README.md` for the full route reference.
- **`mobile/`** — React Native (Expo) app for iOS/Android. See `mobile/README.md`.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env          # point DATABASE_URL at a local Postgres instance
npm install
npx prisma migrate dev --name init
npm run seed                  # sample business, users, supplier, products, one PO
npm run dev                   # http://localhost:4000

# 2. Mobile app (separate terminal)
cd mobile
npm install
npm start                     # then press i / a, or scan the QR code with Expo Go
```

Log in with a seeded account (password `password123` for all):
- `owner@lhpoultry.test` — Owner
- `manager@lhpoultry.test` — Manager
- `cashier@lhpoultry.test` — Cashier

## What's implemented

- **Multi-tenant data model** (`Business` → `User`, `Supplier`, `Product`, `PurchaseOrder`/`PurchaseOrderLineItem`, `Sale`/`SaleLineItem`, `InventoryAdjustment`, `WebExportConfig`/`WebListing`) with every query scoped to the authenticated user's business.
- **Role-based permissions** (Owner > Manager > Cashier), enforced server-side.
- **Purchase orders**: draft → submit → (partially) receive → closed, with an audited `InventoryAdjustment` per receipt and cost-variance flagging when the received cost differs from the PO.
- **Scan-to-PO**: capture/import a photo or PDF, run it through a pluggable OCR adapter (mock adapter for local dev; AWS Textract and Google Document AI adapters included, swap in via `OCR_PROVIDER`), fuzzy-match extracted lines to existing products, and review/correct everything before it becomes a normal `PurchaseOrder` — scanning is an alternate entry point into the same create endpoint, not a separate data path.
- **POS checkout**: product search or barcode scan, cart, tax, cash/card, stock decrement with a configurable negative-stock guard, receipt/sales history.
- **Web export**: a generic REST adapter maps `Product` fields into an external API's JSON shape per a business-configured field-mapping template, pushes per-product or in bulk, and tracks sync status/errors — designed so a platform-specific adapter (Shopify, WooCommerce, ...) can be swapped in later without touching the data model.
- **Tests**: `backend/tests/` unit-tests the pure calculation cores for PO receiving, sale checkout, and web-export field mapping (`npm test` in `backend/`).

See `backend/README.md` for the full API reference and `mobile/README.md` for the screen-by-screen breakdown of the app.
