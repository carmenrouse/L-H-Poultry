# L&H Poultry POS — Mobile App

React Native (Expo) point-of-sale app for iOS/Android. Talks to the `../backend` API.

## Setup

```bash
npm install
```

Set the API base URL the app should talk to in `app.json` → `expo.extra.apiBaseUrl` (defaults to `http://localhost:4000/api`). When running on a physical device, `localhost` won't reach your dev machine — use your machine's LAN IP instead, e.g. `http://192.168.1.20:4000/api`.

```bash
npm start        # opens Expo Dev Tools; scan the QR code with Expo Go, or press i / a
npm run ios       # requires Xcode + iOS simulator
npm run android   # requires Android Studio + emulator
```

Log in with one of the seeded accounts from the backend (see `../backend/README.md`), e.g. `owner@lhpoultry.test` / `password123`.

## Structure

- `src/api/client.js` — axios instance, attaches the stored JWT to every request
- `src/context/AuthContext.js` — login/register/logout, current user, role check helper
- `src/navigation/index.js` — auth stack vs. role-aware bottom-tab main app
- `src/screens/` — one file per screen (see below)
- `src/components/ui.js` — shared Button/Input/Card/Badge primitives
- `src/components/PickerModal.js` — search-and-select modal used for supplier/product pickers

## Screens

| Screen | Purpose |
|---|---|
| Login / RegisterBusiness | Auth |
| Dashboard | Today's sales, low stock, open POs, quick actions |
| Products (list/detail) | Search, create/edit, manual stock adjustment, link to web listings |
| Purchase Orders (list/detail/create) | Manual PO creation, submit/cancel, status filtering |
| ScanPO / ScanReview | Camera capture or image/PDF import → OCR → editable product-matching review → creates a PO |
| ReceiveInventory | Partial/full receiving against a submitted PO, with cost-variance entry |
| POS (Checkout) | Product search, barcode scan (camera), cart, tax, cash/card, completes a sale |
| Sales History / SaleDetail | Past sales, receipt detail |
| Settings | Business tax rate / negative-stock toggle, web export destinations, bulk push |
| WebExportConfig | Create/edit a REST export destination and its field mapping |
| WebListings | Per-product push-to-web action and sync status, reached from Product detail |

Role visibility: the Purchasing tab is hidden for Cashiers, the Settings tab is hidden for everyone but Owners (mirrors the backend's `requireRole` checks — the server is the actual enforcement point, this is just UX).

## Notes on testing this app

This was validated by bundling the full app through Metro (`expo export`) to confirm every screen and import resolves with no syntax errors. It has **not** been exercised in an iOS/Android simulator or against a live backend in this environment — do that locally with `npm run ios`/`npm run android` (or Expo Go) pointed at a running backend + seeded database before shipping.
