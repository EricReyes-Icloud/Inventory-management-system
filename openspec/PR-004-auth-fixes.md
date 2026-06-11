# PR #4 — Fix auth paths, WhatsApp webhook & dev tooling

## Description

This PR addresses three issues found during the monthly closing flow setup:

1. **WhatsApp webhook 404** — The endpoint `POST /api/whatsapp/webhook` returned 404 because the route was registered as `/webhook/whatsapp` instead of `/webhook`, and there was no handler for the bare `/api/whatsapp` path.
2. **Admin auth path mismatch** — The `admin.repository.js` was querying a top-level `Admin` collection that does not exist. Admin data is stored under `Usuarios/Usuarios/Admin/{Admin}` with `Email`, `Activo`, and `Rol` fields.
3. **No dev tooling for testing** — No way to generate Firebase ID tokens or easily test the monthly closing endpoint.

## Changes Made

### Bug fixes

- **`backend/src/whatsapp/index.js`**: Changed route path from `/webhook/whatsapp` to `/webhook` to match the documented endpoint `POST /api/whatsapp/webhook`.
- **`backend/src/repositories/admin.repository.js`**: Updated `getAdminByEmail()` and `getAdminByRol()` to query `Usuarios/Usuarios/Admin` instead of the non-existent top-level `Admin` collection. Filters remain the same (`Email`, `Activo`, `Rol`).
- **`backend/src/index.js`**: Mounted `admin.contabilidad.routes.js` at `/api/admin` (was defined but never imported).

### Dev tooling

- **`backend/scripts/get-token.js`**: New script that generates a valid Firebase ID token for any registered email. Uses the Admin SDK to create a custom token and the Firebase Auth REST API to exchange it for an ID token.
- **`backend/scripts/test-cierre.sh`**: One-command script that generates a token and calls `POST /api/admin/cerrar-mes` with the given `mesAnio`. Usage: `bash scripts/test-cierre.sh "Junio 2026"`.

### Configuration

- **`backend/.env`**: Added `FIREBASE_WEB_API_KEY` needed by `get-token.js` for the Auth REST API exchange.

## Impact

- **WhatsApp webhook** now responds at the correct documented URL.
- **Admin authentication** works correctly, querying the real Firestore path.
- **Monthly closing endpoint** is now live at `POST /api/admin/cerrar-mes` with full admin auth.
- **Dev experience** improved — generating test tokens and running the closing flow takes one command instead of manual copy-paste.
- All changes are backward-compatible: no existing functionality was removed or altered in behavior, only paths corrected.

## Notes

- The endpoint `POST /api/admin/cerrar-mes` requires a Firebase ID token in the `Authorization: Bearer <token>` header. Use `bash scripts/test-cierre.sh "<mesAnio>"` to test.
- Two known issues to address in a follow-up:
  1. Cost validation in `ganancias.service.js` allows zero values (`v < 0` should be `v <= 0`).
  2. Admin audit trail stores UID instead of admin name — pending pipeline refactor.
