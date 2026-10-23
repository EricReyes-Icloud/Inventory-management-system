# PR-027: whatsapp-order-auth-hardening

**Branch:** `feat/backend-robustez`
**Commits:** `2545812`, `14af775`, `aab3724`, `e637557`, `b6665e6`, `cdb8bb6`, `9e8811b`
**State:** Pre-submission — description drafted, awaiting GitHub PR creation

---

## Summary

Endurecimiento de autenticación del flujo de pedidos por WhatsApp en `feat/backend-robustez`.
Cierra los 6 specs de la feature ODD `whatsapp-order-auth-hardening` (S1–S6).

- **S1** — Validación de firma Twilio (HMAC-SHA1) en el webhook
- **S2** — Allowlist de números admin por env var `ADMIN_ALLOWED_NUMBERS` (fail-closed)
- **S3** — Token interno `INTERNAL_API_TOKEN` en `/api/ventas/pedio-libre`
- **S4** — Rate limiting (webhook por remitente, pedido-libre por IP)
- **S5** — CORS con allowlist fail-closed (reemplaza `cors({ origin: true })`)
- **S6** — Las 2 rutas admin que estaban sin auth (`/job-contable`, `/cerrar-categoria`) ahora protegidas

## Changes

| File | Change |
|------|--------|
| `backend/src/whatsapp/index.js` | S1: validación de firma Twilio; S2: allowlist desde config + gate fail-closed |
| `backend/src/config.js` | `parseAdminAllowedNumbers`, `admin.allowedNumbers`, `resolvePositiveInt`, `rateLimit`, `cors.allowedOrigins` |
| `backend/src/middlewares/adminAuth.js` | `adminAuth` (Firebase ID token) compartido por los 2 routers admin |
| `backend/src/middlewares/cors.js` | `createCorsHeaders` + `createCorsGuard` (guard antes del handler) |
| `backend/src/middlewares/rateLimit.js` | `createWebhookRateLimiter` + `createNuevoPedidoLibreRateLimiter` |
| `backend/src/routes/ventas.js` | `requireInternalToken` middleware + rate limiter por IP |
| `backend/src/routes/admin.js` | `/job-contable` ahora exige `Bearer $ADMIN_TOKEN` |
| `backend/src/routes/admin.button.routes.js` | `/cerrar-categoria` ahora exige `adminAuth`; `adminUsuario` desde el token |
| `backend/src/routes/admin.contabilidad.routes.js` | Importa `adminAuth` del middleware compartido |
| `backend/src/index.js` | CORS allowlist + `app.set("trust proxy", 1)` |
| `backend/tests/unit/whatsapp/webhook.security.test.ts` | S1+S2: firmas Twilio reales + variantes E.164 + fail-closed |
| `backend/tests/unit/whatsapp/webhook.ratelimit.test.ts` | S4: webhook rate limit |
| `backend/tests/unit/config.test.ts` | `parseAdminAllowedNumbers` + `resolvePositiveInt` |
| `backend/tests/unit/cors.test.ts` | S5: 13 casos CORS (allowlist, spoof, sin Origin) |
| `backend/tests/integration/admin.routes.test.ts` | S6: auth en rutas admin |
| `backend/tests/integration/ventas.test.ts` | S3: token interno + rate limit |
| `docs/api/api_documentation.md` | Sección admin/autenticación/CORS alineada con el código |
| `odd/tasks/whatsapp-order-auth-hardening.md` | Feature doc (specs S1–S6, tasks T1–T6, log D1–D18) |
| `backend/package.json` | `express-rate-limit@8.7.1` |

## Test Plan

- [x] `npm run test:ci` → **250/250, 25 files**
- [x] RED→GREEN observado en T4, T5, T2 (env var move)
- [x] Verificación independiente delegada (T6): 6/6 S# MET, 0 blockers
- [x] Verificación en runtime contra Firestore de producción (solo lectura): CORS 200/403, webhook 403, rutas admin 401
- [x] `npm run seed:catalog -- --dry-run` → 24/53/12, exit 0 (no tocado por este cambio)

## Env vars a setear en Render/Railway

| Var | Valor | Fail-closed |
|-----|-------|-------------|
| `ADMIN_ALLOWED_NUMBERS` | `+57313...,+57313...,+57313...` (los 3 admins) | **Sí** — sin ella, todo origen recibe 403 |
| `TWILIO_AUTH_TOKEN` | token de Twilio | — |
| `INTERNAL_API_TOKEN` | token compartido | **Sí** — sin él, `/api/ventas/pedio-libre` da 403 |
| `ADMIN_TOKEN` | token del panel admin | **Sí** — sin él, `/api/admin/recargar-catalogo` da 401 |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min, default) | — |
| `RATE_LIMIT_MAX` | `60` (default) | — |
| `CORS_ALLOWED_ORIGINS` | orígenes del frontend | **Sí** — sin ella, todo origen de browser recibe 403 |

## Notas

- **Frontend**: el cliente React vive en otro repositorio. `POST /admin/cerrar-categoria` ahora exige `Authorization: Bearer <firebase id token>`; sin ese cambio el botón de cierre de categoría da 401.
- **RDD**: intentado 2 veces (provider_failed, luego binding_mismatch en los 4 lentes). Ambos fallaron por defectos del provider Gentle AI, no del código. El cambio de env var se skippeó por bajo riesgo (config-only, fail-closed, tests cubren).
- **Rama**: `feat/backend-robustez`. Commits: `2545812`, `14af775`, `aab3724`, `e637557`, `b6665e6`, `cdb8bb6`, `9e8811b`.
- **Higiene**: `.atl/.skill-registry.md` y `.atl/.skill-registry.cache.json` quedan sin commitear (generados por gentle-ai).