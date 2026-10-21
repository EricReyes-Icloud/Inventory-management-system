# Feature: ventas-service-extraction

**Objective:** Remove the backend's hardcoded self-HTTP call (`http://localhost:4000`) from the
WhatsApp order path by extracting the order-registration business logic into a service, and stop
swallowing registration failures — a failed order now answers the customer with an error message
instead of a false "✅ Pedido recibido correctamente".
**Branch:** `feat/backend-robustez` (user-mandated — no new branch).
**Delivery strategy:** `ask-on-risk` (default). Forecast ≈300 authored changed lines → single PR,
no chain. Push/PR remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest) — baseline 187 tests / 20 files.

## Specs

**S1 — The backend never calls itself over HTTP to register an order.**
Scope: `backend/src/brain/inturis.js`, `backend/src/services/ventas.service.js` (new).
Source (verbatim from the change request): "Tenemos un puerto Hardcodeado (localhost:4000)
deberia ser variable de entorno. En producción esto apunta a otro host, y si no esta configurado,
silenciosamente falla."
Acceptance: the order-registration path contains no hardcoded host and no HTTP client. The
registration runs in-process through the service. After the change, `backend/src` contains no
`localhost`/`127.0.0.1` literal and no `axios` import.
Check: `grep -rnE 'localhost|127\.0\.0\.1' backend/src` returns nothing; `grep -rn 'axios'
backend/src` returns nothing; unit test asserts the registration seam is invoked in-process.

**S2 — Order-registration business logic lives in a service, not in the route handler.**
Scope: `backend/src/services/ventas.service.js` (new), `backend/src/routes/ventas.js`.
Source (verbatim from `AGENTS.md`): "Separar lógica de negocio del transporte (API)" and
"Backend debe seguir arquitectura modular: routes / services".
Acceptance: the service owns validation, client lookup, interpretation, product resolution,
pricing and the Firestore writes. `routes/ventas.js` is a thin adapter that delegates and maps
the service result to the HTTP status + JSON body. The route performs no repository call and no
interpretation of its own.
Check: code inspection of the route (no repository/loader references); new unit suite for the
service; existing integration suite still green.

**S3 — The public response contract of `POST /api/ventas/pedido-libre` is unchanged.**
Scope: `backend/src/routes/ventas.js`, `backend/src/services/ventas.service.js`.
Acceptance: every status code and JSON body is preserved byte-for-byte — `400
cliente_requerido`, `400 mensaje_requerido`, `404 cliente_no_encontrado: <cliente>`, `400
ningun_producto_identificado` with `sugerencias` (catalog keys), `400
ningun_producto_identificado` with `sugerencias` (interpreted product names), `400
datos_incompletos_para_producto: <json>`, `400 producto_no_encontrado: <path>`, `500
error_creando_pedido_libre` + `details`, and the `200` success payload (`pedidoId`, `clienteId`,
`clienteNombre`, `descripcionPedido`, `total`, `tipoPedido`, `estadoContable`).
Check: the existing integration suite (`backend/tests/integration/ventas.test.ts`) passes with the
same assertions; the suite is the regression net for this spec.

**S4 — A failed registration is reported to the WhatsApp customer, not silently swallowed.**
Scope: `backend/src/brain/inturis.js`, `backend/src/whatsapp/index.js`.
Source (verbatim from the maintainer's decision): "(b) responder con un mensaje de error para el
cliente".
Acceptance: when the order cannot be registered, the customer receives an error message and
never the confirmation. Proposed copy (needs maintainer review before release):
`"⚠️ No pudimos registrar tu pedido. Por favor, intenta más tarde y comunícate con servicio
técnico de inmediato."` The server logs the cause. The pre-existing "🚫 Este mensaje no ha sido
comprendido" branch keeps its current copy and trigger.
Check: unit test for the webhook path asserting the error message is sent and the confirmation
is NOT sent when the registration fails; a companion test asserting the confirmation IS sent when
the registration succeeds.

**S5 — The port is configured from the environment in one place and validated at boot.**
Scope: `backend/src/config.js` (new), `backend/src/index.js`.
Source (verbatim from the change request): "deberia ser variable de entorno".
Acceptance: `PORT` is read in exactly one module. A missing/empty `PORT` keeps today's default
`4000`. A non-integer or out-of-range `PORT` fails at boot with a clear message instead of
silently binding a named pipe (`net.Server.listen(string)`), which is what `PORT=4a00` does
today. No new required environment variable is introduced — the order path needs no host after
S1, and every other variable the boot depends on already fails fast (`catalogLoader.init()` →
`process.exit(1)`) or fails closed at request time (`requireAdminToken` → 401).
Check: unit test for the config module covering unset, valid and invalid values; boot smoke check.

**S6 — The order message is interpreted exactly once per order.**
Scope: `backend/src/services/ventas.service.js`, `backend/src/brain/inturis.js`.
Acceptance: the interpretation is computed once per registration and the same result is handed
back to the caller. Today the flow interprets twice (`inturis.js:113` and again in
`routes/ventas.js:46`).
Check: unit test asserting the interpretation seam is invoked exactly once per registration.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S5 | inline | Add `backend/src/config.js` (validated `PORT`) and consume it in `backend/src/index.js` — RED test first | ⏳ | — |
| T2 | S2,S3 | inline | Extract `crearPedidoLibre` into `backend/src/services/ventas.service.js`; reduce `routes/ventas.js` to a thin adapter; keep the integration suite green | ⏳ | — |
| T3 | S1,S6 | inline | Call the service from `brain/inturis.js` — drop `axios` and the self-HTTP call; interpret once | ⏳ | — |
| T4 | S4 | inline | Surface the registration failure in `whatsapp/index.js` with the error message | ⏳ | — |
| T5 | all | inline | Full suite + work-unit commits on the feature branch | ⏳ | — |
| T6 | all | delegated | Independent verification (high risk: item 3 — public API contract + customer-facing copy) | ⏳ | — |

## Log

**L1 (user, verbatim):** "No ya cerramos esa deuda y nos limitamos a solo solucionar eso en
especifico. Ahora quiero que trabajemos en varias deudas tecnicas pequeñas que tenemos en el
proyecto te parece. Empecemos por esta, solo explora y analiza el código despues de eso si te
confirmo que implementes: Tenemos un puerto Hardcodeado (localhost:4000) deberia ser variable de
entorno. En producción esto apunta a otro host, y si no esta configurado, silenciosamente falla."

**L2 (user, verbatim):** "Si voy a tomar la opcion C para el cambio, y (b) responder con un
mensaje de error para el cliente. Como es feature importante debemos seguir ODD."

**D1 — Classification (2026-10-21).** Large, hence this feature document. The resume test fails:
the change spans a new service module, a rewritten route, the WhatsApp brain, the webhook, the
boot, plus new unit suites and a customer-facing behavior change — six-plus files whose intent
cannot be reconstructed from `git diff` alone. High risk: item 3 (the public
`/api/ventas/pedido-libre` contract and the customer-facing WhatsApp message are consumed by
others) and item 6 (the failure path had zero coverage, so no existing test would catch a
regression there). Hence the independent verifier in T6.

**D2 — The port was never the defect (2026-10-21).** Verified from the repository:
`backend/src/index.js:53` already reads `process.env.PORT || 4000`. The single hardcoded
host:port in runtime source is `backend/src/brain/inturis.js:122`
(`axios.post("http://localhost:4000/api/ventas/pedido-libre")`) — the backend calling itself
over HTTP. The debt is the self-call, not the port.

**D3 — Why the failure is silent (2026-10-21).** Three chained steps:
(1) `inturis.js:128-130` catches and only `console.error`s; (2) `inturis.js:133` returns
`{ cliente, resultado }` with no error flag; (3) `whatsapp/index.js:88` evaluates
`interpretacion.error` → `undefined` → the customer receives "✅ Pedido recibido correctamente"
although the order was never written to Firestore. The same path swallows `404
cliente_no_encontrado` and `400 ningun_producto_identificado`.

**D4 — Why production breaks (2026-10-21).** Deployment targets are Render/Railway
(`README.md:159-161`); both inject `PORT` themselves, and `backend/.env` does not define `PORT`.
The server listens on the platform port while the self-call still targets 4000 →
`ECONNREFUSED`.

**D5 — Design decision: service owns the interpretation (2026-10-21).** The service requires
`brain/inturis` lazily inside the function to break the require cycle
(`brain/inturis` → `services/ventas.service` → `brain/inturis`). Moving `interpretarPedido` to
its own module would break the existing integration seam, which mocks `src/brain/inturis.js` via
`Module._cache`; the lazy require keeps that seam working and preserves the current order of
operations (validate → client lookup → interpret).

**D6 — Design decision: no `API_BASE_URL` variable (2026-10-21).** After the self-call is
removed, the backend has no host to configure for this flow. Adding an unused
`API_BASE_URL` export would be dead configuration, so `config.js` exposes only the validated
`PORT`. If a future flow needs an HTTP self-call, the variable is added with its consumer.

**D7 — Collateral finding, not in scope (2026-10-21).** `brain/inturis.js:105` requires `axios`,
which `backend/package.json` does not declare: it resolves only because `twilio@^1.12.0` depends
on `axios@^1.12.0` and npm hoisted it to `backend/node_modules/axios` (the lockfile confirms
`twilio` is the only dependent). Removing the `axios` import (S1) closes that latent fragility
as a side effect. `backend/scripts/test-cierre.sh:24,27` also hardcodes `localhost:4000`; that
is a developer script, out of scope for this feature.
