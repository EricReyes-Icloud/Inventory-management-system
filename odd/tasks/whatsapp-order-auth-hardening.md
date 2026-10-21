# Feature: whatsapp-order-auth-hardening

**Objective:** Restrict order creation to only the three authorized administrator phone numbers coming through Twilio, validate Twilio request signatures, prevent spoofing/public abuse of `/api/ventas/pedido-libre`, add rate limiting, tighten CORS, and review admin route protection. Orders must only come from Twilio and from those 3 authorized numbers (no other numbers, no arbitrary clients creating pedidos).

**Branch:** `feat/backend-robustez`
**Delivery strategy:** `ask-on-risk` (default). Security hardening, single PR likely. Push/PR remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest)

## Specs

**S1 — Validate Twilio webhook signatures**
Scope: `backend/src/whatsapp/index.js`
Acceptance: Only requests with a valid `X-Twilio-Signature` and correct auth token are processed. Invalid/missing signature → 403. Must use Twilio's validation against the full URL + params.
Check: Manual/test with invalid signature returns 403. No bypass path.

**S2 — Allowlist only 3 administrator phone numbers**
Scope: `backend/src/whatsapp/index.js`, `backend/src/config.js` (or new auth config), `backend/src/repositories/*` if needed
Acceptance: Only numbers in the authorized allowlist that correspond to administrators can create orders. The 3 numbers must belong to administrators only. Numbers compared in E.164. Source: `Telefono` in `Usuarios/Usuarios/Admin`, `Usuarios/Usuarios/Admin_2`, or `Usuarios/Usuarios/Admin_3`. Any other number → reject with a safe message (no pedido created).
Check: Unit test with allowed admin number passes, non-allowed rejected, unknown rejected.

**S3 — Restrict `/api/ventas/pedido-libre`**
Scope: `backend/src/routes/ventas.js`, `backend/src/middlewares/*`
Acceptance: This endpoint must not be freely callable by anyone. Orders must come only from Twilio and the system. Prefer blocking or hard-restricting (internal auth/token) to prevent direct abuse.
Check: Direct call without valid internal auth/rule → rejected.

**S4 — Rate limiting on order-creation paths**
Scope: `backend/src/whatsapp/index.js`, `backend/src/routes/ventas.js`, new middleware
Acceptance: `express-rate-limit` applied to `/api/whatsapp/webhook` and `/api/ventas/pedido-libre`. Reasonable window/max, 429 on exceed.
Check: Limits enforced.

**S5 — Tighten CORS**
Scope: `backend/src/index.js`
Acceptance: Replace `cors({ origin: true })` with allowlist from config. Unknown origins blocked or restricted.
Check: CORS policy applied.

**S6 — Review and harden admin routes consistency**
Scope: `backend/src/routes/admin*.js`, `backend/src/index.js`
Acceptance: Ensure all admin-modifying routes use `adminAuth`. Verify `/admin/*` and `/api/admin/*` coverage.
Check: Inspection.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S1 | inline | Add Twilio signature validation middleware to `/api/whatsapp/webhook`. Load auth token from env. Reject invalid/missing with 403. | ✅ | `backend/tests/unit/whatsapp/webhook.security.test.ts` → S1 block (4 cases: missing signature, invalid signature, signature for another body, token not configured) + 1 happy path. Suite 211/211. |
| T2 | S2 | inline | Enforce admin phone allowlist: check `From` against `Usuarios/Usuarios/Admin`, `Admin_2`, `Admin_3` by `Telefono`. Allow only the 3 authorized admin numbers. Reject others safely. | ✅ | Same file → S2 block (5 cases: not in allowlist, allowlisted but not admin, the 3 admins accepted, E.164 normalization, missing `From`). |
| T3 | S3 | inline | Restrict `/api/ventas/pedido-libre` (require `x-internal-token`). | ✅ | `backend/tests/integration/ventas.test.ts` → `internal token` block (3 cases: missing token, wrong token, `INTERNAL_API_TOKEN` not configured). No in-repo caller breaks: the endpoint has no frontend caller. |
| T4 | S4 | inline | Add rate limiting middleware for webhook and pedido-libre. | ⏳ | — |
| T5 | S5,S6 | inline | Tighten CORS to allowlist. Audit admin routes. | ⏳ | — |
| T6 | all | delegated | Independent verification (high risk: security). | ⏳ | — |

## Log

**L1 (user, verbatim):** "Bien ese plan de 6 pasos y 3 prioridades me gusta. Solo te quiero comentar el flujo de negocio, los pedidos deben venir solo desde Twilio y desde el mismo sistema, pero no de cualquier numero, quiero que lo restrinjamos a tres numeros de los cuales corresponden solo a los administradores, aquellos que solo podrán enviar pedidos en el sistema. Con esto claro podemos empezar con este nuevo change, empecemos con la doc y todo lo que indica ODD por favor. Sigamos esos 6 pasos que me indicas."

**D1 (2026-10-22) — Classification:** LARGE. High risk (security: auth/permisos). Tracking required before first write.

**D2 (2026-10-22) — Business rule:** Orders must come ONLY from Twilio and from the same system. Restrict to exactly 3 phone numbers, and those numbers must belong to administrators only. No other numbers allowed.

**D3 (2026-10-22) — Authorized numbers & DB mapping:**  
- +573138861417 (Eric)  
- +573213413474 (July)  
- +573203648967 (Edwin)  

These numbers exist as `Telefono` in the database under `Usuarios/Usuarios/Admin`, `Usuarios/Usuarios/Admin_2`, or `Usuarios/Usuarios/Admin_3`. We must normalize (strip spaces/dashes/parentheses) and match against those collections/documents. The number must belong to an admin only. Compare in E.164.

**D4 (2026-10-21) — Reconciliation after the frozen session.** The previous session froze right after writing the T1–T3 implementation: the code was in the working tree, uncommitted, with **zero tests**, the Tasks table still showed every task as pending, and the Engram mirror (`odd/whatsapp-order-auth-hardening/tasks`) did not exist. Baseline suite with that code: 198/198 green — green, but proving nothing about the new auth paths (there was no webhook test in `backend/tests` at all).
Decision: close T1–T3 with their missing tests **before** starting T4/T5, because a work-unit commit without tests is debt, not evidence, and ODD only checks a task off after its checks were observed. T1–T3 therefore land as **one** work unit (single coherent behavior: "who may create an order and how"), not three: T1 and T2 live in the same file (`backend/src/whatsapp/index.js`) and splitting them would mean manufacturing intermediate file states.

**D5 (2026-10-21) — Test strategy for the webhook.** The Twilio SDK is **not** mocked: the tests compute a real signature (HMAC-SHA1 over `url + sorted params`, base64 — the SDK's own `getExpectedTwilioSignature` algorithm) and let the real `validateRequest` verify it, so the crypto path is covered end to end instead of stubbed. Two environment facts were needed to make that work:
- the SDK validates the URL **with and without the port**, so signing `http://127.0.0.1/api/whatsapp/webhook` is valid regardless of the ephemeral supertest port; the test pins `Host: 127.0.0.1` to make it deterministic;
- `vi.mock` does **not** intercept the CommonJS `require()` calls inside `backend/src/whatsapp/index.js` (the real `admin.repository` ran and hit Firestore). The repo's established pattern — `Module._cache` injection, as in `backend/tests/integration/ventas.test.ts` and `backend/tests/unit/repositories/admin.repository.test.ts` — is used instead.

**D6 (2026-10-21) — Honest evidence note for T1–T3.** No RED could be observed for T1–T3: the previous session wrote the implementation before freezing, so the new tests pass on the first run. The RED→GREEN discipline applies from T4 onward. What the new tests do prove is that the implementation behaves as S1/S2/S3 specify (missing/invalid/forged signature → 403; non-allowlisted or non-admin sender → 403; missing/incorrect internal token → 403 with no order written).

**D7 (2026-10-21) — Work unit 1 committed.** Commit `2545812` on `feat/backend-robustez`: T1 + T2 + T3 (implementation recovered from the frozen session) + the missing test coverage + this feature doc. Suite: **211/211 green, 22 files** (was 198/198, 21 files). T1–T3 land as one work unit because T1 and T2 live in the same file and splitting them would mean manufacturing intermediate states.

**D8 (2026-10-21) — Pending dependency install for T4.** `express-rate-limit@^8.7.1` is already declared in `backend/package.json` and `package-lock.json` (lockfile entry complete, with integrity hash), but the install was interrupted before `backend/node_modules/express-rate-limit` was materialized. Next session: run `npm install` at the repo root before implementing T4.

**Next step (for the next session):** start directly with **T4** (rate limiting) — no further reconciliation or exploration needed. Design already decided:
- new middleware `backend/src/middlewares/rateLimit.js`; config in `backend/src/config.js` (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` env, window 15 min / max 60 as defaults);
- webhook limiter keyed by the normalized admin sender number and placed **after** `validateTwilioSignature` + `authorizeAdminSender` (only authenticated traffic consumes the limit; the 403 path is cheap and touches no Firestore, because the allowlist is checked before the admin lookup);
- pedido-libre limiter keyed by IP, placed **after** the `x-internal-token` check;
- 429 on exceed, per S4.
