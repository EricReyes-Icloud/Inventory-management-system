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
| T2 | S2 | inline | Enforce admin phone allowlist: allowlist sourced from `ADMIN_ALLOWED_NUMBERS` (env, fail closed) via `config.admin.allowedNumbers` + `parseAdminAllowedNumbers`; check `From` normalized against that list (gate runs first), then verify existence as admin in `Usuarios/Usuarios/Admin`, `Admin_2`, `Admin_3` by `Telefono`. Allow only the 3 authorized admin numbers. Reject others safely; no `Activo`/`Rol` filters. | ✅ | Same file → S2 block (5 casos originales + "rejects a sender that exists as admin in Firestore but is not in ADMIN_ALLOWED_NUMBERS" + "fails closed when ADMIN_ALLOWED_NUMBERS is not configured"). | Env var move: `9e8811b` (2026-10-23).
| T3 | S3 | inline | Restrict `/api/ventas/pedido-libre` (require `x-internal-token`). | ✅ | `backend/tests/integration/ventas.test.ts` → `internal token` block (3 cases: missing token, wrong token, `INTERNAL_API_TOKEN` not configured). No in-repo caller breaks: the endpoint has no frontend caller. |
| T4 | S4 | inline | Add rate limiting middleware for webhook and pedido-libre. | ✅ | `backend/tests/unit/whatsapp/webhook.ratelimit.test.ts` (4 casos: hasta el máximo, 429 al exceder, presupuesto separado por admin, el 403 previo no consume presupuesto) + `backend/tests/integration/ventas.test.ts` bloque `rate limit` (3 casos: hasta el máximo, 429 sin escribir el pedido, el 403 por token no consume presupuesto) + `backend/tests/unit/config.test.ts` (10 casos de `resolvePositiveInt` y `config.rateLimit`). Suite **228/228, 23 archivos** (antes 211/211, 22). |
| T5 | S5,S6 | inline | Tighten CORS to allowlist. Audit admin routes. | ✅ | `backend/tests/unit/cors.test.ts` (13 casos: parseo de `CORS_ALLOWED_ORIGINS` + guard por origen) + `backend/tests/integration/admin.routes.test.ts` (9 casos: `job-contable` con token de admin, `cerrar-categoria` con `adminAuth`, nombre de admin tomado del token verificado). Suite **250/250, 25 archivos** (antes 228/228, 23). |
| T6 | all | delegated | Independent verification (high risk: security). | ✅ | Verificador independiente (`gentle-ai-verify`) sobre el rango `192e76e..e637557`: **S1-S6 MET, 0 blockers, 0 advisories**. Probes propios en copia scratch (`/tmp/opencode/verify-pqDz`, current + baseline por `git archive`): matriz de firmas Twilio, allowlist E.164 de los 3 admins, token interno, presupuestos de rate limit (429 sin escritura), CORS fail-closed + guard antes del handler, y barrido de todas las rutas admin. Baseline reproducido para separar regresión de comportamiento pre-existente. Suite 250/250 en 25 archivos; spot check del parent re-ejecutado. Sin correcciones necesarias. |

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

**D9 (2026-10-21) — T4 design decisions.** The design decided in the previous session was implemented as follows, with three points that needed a decision:
- **Limiters are factories, not module-level instances.** `backend/src/middlewares/rateLimit.js` exports `createWebhookRateLimiter()` / `createPedidoLibreRateLimiter()`; each router calls its factory at module load, so each route owns its own budget. A shared instance would leak one route's traffic into the other's, and would make the budget leak across tests.
- **The config is read lazily inside the factory.** `require("../config")` happens inside the factory, not at module load, so the limiter always sees the config module that is currently cached (tests reload it to drive a small budget).
- **`trust proxy` was added to `backend/src/index.js`** (`app.set("trust proxy", 1)`). The backend runs behind a proxy (Render/Railway); without it `req.ip` is the proxy's IP and the IP-keyed pedido-libre limiter degenerates into a single global bucket for the whole system. It does not change the S1 signature validation, which already reads `x-forwarded-proto` / `x-forwarded-host` explicitly.

**D10 (2026-10-21) — RED→GREEN evidence for T4.** RED was observed before implementing: 13 failing tests — `TypeError: resolvePositiveInt is not a function` and `Cannot read properties of undefined (reading 'windowMs')` in `config.test.ts`, and `expected 200 to be 429` in both rate limit suites. Every failure was "implementation missing", not a broken test. After implementation: **228/228 green, 23 files** (was 211/211, 22 files). No `express-rate-limit` validation warning is emitted at runtime.

**D11 (2026-10-21) — Known limitations of T4 (deliberate, not bugs).**
- The budget is in memory and **per process**: with more than one instance behind the load balancer the effective limit is multiplied by the number of instances. A shared store (Redis) would be needed for a multi-instance deployment.
- The webhook limiter is mounted **after** `authorizeAdminSender`, so the Firestore admin lookup still runs on every authenticated request. The limiter caps the expensive part (order interpretation and writes), not that lookup.
- A 429 tells Twilio the webhook failed, so **Twilio will retry** the message. The retried request is not a duplicate order: a rate-limited request never reached the order pipeline.

**D12 (2026-10-21) — T5 design: CORS con allowlist, fail closed.**
- La allowlist vive en `config.cors.allowedOrigins` y se parsea de `CORS_ALLOWED_ORIGINS` (lista separada por comas). Cada origen se normaliza con `new URL(...).origin`: `https://app.com/` y `https://app.com` son el mismo origen, y el comodín `*` se conserva como opt-in explícito.
- **Fail closed**: sin `CORS_ALLOWED_ORIGINS` la lista queda vacía y **todo** origen de navegador recibe 403. Es la misma decisión que el maintainer ya tomó para `ADMIN_TOKEN` (ver `openspec/changes/catalog-single-source/verify-report.md`, "fails closed ... the maintainer authorized this strict behavior over the original soft-fail"), y es coherente con el encabezado de `config.js`: un valor mal configurado no debe fallar en silencio. El arranque NO se cae: el backend levanta y avisa por consola, para que un deploy sin la variable no quede mudo.
- **Dos capas, no una.** `createCorsHeaders()` (librería `cors`) solo escribe cabeceras para orígenes permitidos; `createCorsGuard()` corta la request con 403 `origin_not_allowed` **antes** del handler. Con una sola capa el browser bloquea la lectura de la respuesta, pero el efecto del lado del servidor (escritura en Firestore) ya ocurrió. El guard lo evita.
- **Una request sin cabecera `Origin` no es traffic de browser** (Twilio, curl, cron) y se deja pasar: CORS no aplica ahí y la protección real la dan los tokens. Verificado en runtime: el webhook sin `Origin` sigue llegando a la validación de firma de Twilio (`{"error":"forbidden"}`), no a un 403 de CORS.

**D13 (2026-10-21) — Auditoría de rutas admin (S6) y qué guard usa cada una.**
Inventario completo de las rutas del backend y su protección antes/después de T5:

| Ruta | Guard antes | Guard después |
|---|---|---|
| `POST /api/whatsapp/webhook` | firma + allowlist + rate limit (T1-T4) | igual |
| `POST /api/ventas/pedido-libre` | token interno + rate limit (T3-T4) | igual |
| `POST /api/admin/job-contable` | ❌ **ninguno** | ✅ `requireAdminToken` (`ADMIN_TOKEN`) |
| `POST /api/admin/recargar-catalogo` | ✅ `requireAdminToken` | igual |
| `POST /api/admin/cerrar-mes` | ✅ `adminAuth` (Firebase) | igual |
| `POST /admin/cerrar-categoria` | ❌ **ninguno** | ✅ `adminAuth` (Firebase) |
| `GET /api/productos`, `GET /api/ping` | lectura publica | igual |

La elección del guard no es arbitraria, sale de **qué tipo de cliente llama a cada endpoint**:
- `job-contable` y `recargar-catalogo` viven en el mismo archivo (`routes/admin.js`) y se documentan como llamadas de máquina: `curl -X POST localhost:4000/api/admin/recargar-catalogo -H "Authorization: Bearer $ADMIN_TOKEN"` (ver `openspec/PR-024-catalog-single-source.md`). Mismo guard, misma variable, misma forma de invocarlo.
- `cerrar-categoria` y `cerrar-mes` son los botones del panel admin: el usuario está autenticado en Firebase y el repo ya tiene la herramienta para eso (`backend/scripts/get-token.js` + `backend/scripts/test-cierre.sh` contra `cerrar-mes`). Por eso `adminAuth` (ID token de Firebase + verificación en la colección de administradores).

**Consecuencia operativa (frontend, repo aparte):** el frontend NO vive en este repo (no existe `frontend/` en ninguna rama; el `package.json` raíz lo declara como workspace pero el código está en otro repositorio). `POST /admin/cerrar-categoria` ahora exige `Authorization: Bearer <firebase id token>`: **el botón del panel admin va a recibir 401 hasta que el repo del frontend envíe el ID token**. Es el precio de cerrar el endpoint y es parte del trabajo pendiente fuera de este repo. `POST /api/admin/job-contable` pasa a exigir `Authorization: Bearer $ADMIN_TOKEN`.

**D14 (2026-10-21) — `adminAuth` se extrae a `middlewares/` y la auditoría usa el token verificado.**
- `adminAuth` estaba definido dentro de `routes/admin.contabilidad.routes.js`, donde no podía ser reusado. Se movió tal cual a `backend/src/middlewares/adminAuth.js` (mismo comportamiento, mismos mensajes) y los dos routers lo importan. El contrato de `openspec/specs/admin.contabilidad.routes/spec.md` se mantiene: `req.admin` sigue siendo `{ uid, email, nombre }`.
- `cerrar-categoria` tomaba `adminUsuario` **del body**, o sea que el nombre que se auditaba lo elegía el cliente. Ahora sale de `req.admin.nombre`, que viene del documento del administrador en Firestore: la auditoría no se puede falsificar desde el request.

**D15 (2026-10-21) — T6: verificación independiente de la feature completa (S1-S6).**
Verificador independiente sobre el rango `192e76e..e637557` (work units `2545812`, `aab3724`, `e637557`). Veredicto: **S1-S6 MET, 0 blockers, 0 advisories**. Trabajo sobre copia scratch (`mktemp -d` bajo `/tmp/opencode`) con el baseline extraído por `git archive`, y probes propios (no los tests del writer, que nunca son evidencia):
- **S1**: firma ausente/garbage/token incorrecto/firma sobre otra URL/params alterados/token sin configurar -> todos 403 `{"error":"forbidden"}`; `GET /webhook` -> 404 (no hay bypass); `procesarMensajeTwilio` solo se invoca desde el webhook.
- **S2**: 6 variantes de formato del numero (con `whatsapp:`, espacios, guiones, sin `+`, 10 digitos) normalizan a E.164 y llegan al lookup de admin; numero fuera de la allowlist -> 403 con mensaje seguro **sin lookup de admin y sin called al pipeline**; allowlisted pero no admin -> 403; repo con error -> 403; `From` ausente -> 403.
- **S3**: sin / con token incorrecto / sin `INTERNAL_API_TOKEN` -> 403 y `crearPedidoLibre` nunca invocado. El probe contra el baseline `192e76e` demostro que el endpoint **estaba abierto** (200 + escritura) antes del cambio.
- **S4**: webhook con max=3 -> 4to request 429; los 403 no consumen presupuesto; presupuestos independientes por admin. pedido-libre con max=2 -> 3er request 429 **sin escritura** (contador de mock = 2). Defaults `{windowMs: 900000, max: 60}`; `RATE_LIMIT_MAX=0` -> el arranque falla.
- **S5**: fail-closed (todo origen de browser 403 `origin_not_allowed`, el server igual levanta, el traffic sin `Origin` pasa); spoof por sufijo (`app.com.evil.com`) -> 403; mismatch de esquema -> 403; slash final y mayusculas normalizados -> permitido; ACAO solo para origenes permitidos; `*` como opt-in. **Guard antes del handler**: con token interno valido y `Origin` no permitido, `crearPedidoLibre` no fue invocado.
- **S6**: barrido de todas las rutas mutantes: `job-contable` y `recargar-catalogo` con `requireAdminToken` (fail-closed en 3 vias: sin configurar / sin header / invalido -> 401); `cerrar-mes` y `cerrar-categoria` con `adminAuth` (401 limpio, no 500, ante token basura; sin escritura cuando la auth se rechaza); las unicas escrituras publicas restantes son las dos rutas de pedidos ya protegidas. `adminUsuario` sale del token verificado (`req.admin.nombre` = "Xavier" observado aunque el body mandara "Evil"). D14 confirmado: `adminAuth` extraido con cuerpo y mensajes identicos al baseline.
- **D11-D13 se comportaron como esta documentado**: el 429 no genera pedido duplicado, el retry de Twilio nunca llega al pipeline, y el 401 del panel admin (repo del frontend aparte) es limpio.
- **Sin correcciones**: no hubo blockers, asi que no se abrio ninguna tanda de correccion.

**Probes durables devueltos por el verificador**: los 4 propuestos (matriz de firmas/E.164, tabla de presupuesto de rate limit, guard-de-CORS-antes-del-handler, `adminUsuario` desde el token) **duplican cobertura ya existente** en `backend/tests/unit/whatsapp/webhook.security.test.ts`, `backend/tests/unit/whatsapp/webhook.ratelimit.test.ts`, `backend/tests/integration/ventas.test.ts`, `backend/tests/unit/cors.test.ts` (el invariante de guard-antes-del-handler ya esta pineado en `cors.test.ts:175-192`) y `backend/tests/integration/admin.routes.test.ts`. No se agregan tests redundantes.

**Unico check no ejecutable**: `npm run build -w backend` no existe (los scripts de `backend/package.json` son start, dev, test, test:watch, test:run, coverage). La suite completa es la superficie de comprobacion disponible.

**D17 (2026-10-23) — Allowlist moved from hardcoded to env var.** Decision: move the allowlist from a literal array in `backend/src/whatsapp/index.js` to `ADMIN_ALLOWED_NUMBERS` (comma-separated, E.164) via `backend/src/config.js` (`parseAdminAllowedNumbers` + `admin.allowedNumbers`). Why: config smell / dual source of truth / redeploy without code change. What did NOT change: still exactly the 3 numbers, still fail-closed when unset/empty (nobody allowed, webhook returns 403 and warns on module load), Firestore `getAdminByTelefono` remains the second, authoritative check, no `Rol`/`Activo` filters added, Twilio signature validation/rate limiter/order unchanged. Tests added first (RED observed): `config.test.ts` new `parseAdminAllowedNumbers` describe (5 cases) failed with `TypeError: parseAdminAllowedNumbers is not a function`; `webhook.security.test.ts` failed with `expected 200 to be 403` for "fails closed when ADMIN_ALLOWED_NUMBERS is not configured". Implemented to GREEN. Focused run: `npx vitest run tests/unit/config.test.ts tests/unit/whatsapp/webhook.security.test.ts tests/unit/whatsapp/webhook.ratelimit.test.ts` from `backend/` → **3 passed (3 files), 42 passed (42 tests)**. Full suite: `npm run test:ci` from repo root → **250 passed (250 tests), 25 passed (25 files)**.

**D16 (2026-10-21) — RDD: assess ejecutado y review abierto (transporte bloqueado).**
- **`review assess` corrido sobre los 4 bases** (`192e76e`, `14af775`, `aab3724`, `e637557`): los 4 devuelven `risk: high`, `review_due: true`, `review_due_reason: high_risk`. El unico signal es `hot_path` / `signal: auth` sobre `odd/tasks/whatsapp-order-auth-hardening.md` — un **markdown**, no codigo (el base `e637557`, que son 19 lineas de doc, tambien sale `high`). El detector es heuristico por senal de texto; no se puede bajar el tier, pero conviene saber que no leyo codigo.
- **No hay selector de target/revision en `assess`**: el candidato es siempre `base..HEAD`. Como `develop..192e76e` esta vacio, `192e76e` es el branch point y el unico candidato posible es `192e76e..HEAD` = la feature entera (= el PR slice, que es lo que esta feature es: un solo PR).
- **Review abierto**: lineage `review-d0fef618d27025e0`, target `sha256:6db4e59eafda5a6c084b75dd5527ecc9ec609abbc8f33deaeba89e400c642a27`, 4 lentes (risk, resilience, readability, reliability), `correction_budget: 200`, 21 archivos / 2190 lineas. El consentimiento lo otorgano el maintainer ("Revisar este cambio").
- **BLOQUEO ACTUAL**: los 4 `review.capture-result` fallan con `opencode_review_transport_relay_refused (reason: provider_failed)`. Falla igual en grupo y en retry individual, con los 4 modelos `review-*` en estado `active` — **es el hook de transporte del runtime de OpenCode (host), no el binario de Gentle AI**. La transaccion sigue abierta: el STATUS ligado reofrece los mismos 4 slots con los mismos `subject_hash`, asi que no se perdio nada y se puede reanudar.
- **Defecto de serializacion del provider (Gentle AI, no del runtime)**: el `next_transition.execute.command` que devuelve `review status` usa la forma `--target-evidence=<valor>` y su propio `review start` la RECHAZA con `invalid_request` / `cause: "--target-evidence paths_digest is not a sha256 digest"` (la causa real: STATUS emite el digest con prefijo `sha256:` -> 7 campos separados por `:`, y el parser documentado espera 6). La forma espacio-separada (`--target-evidence <valor>`, la misma que usan las invocaciones del envelope de consentimiento) parsea bien. Workaround aplicado: ejecutar la forma espacio-separada.
- **Como reanudar**: `gentle-ai review status --cwd <repo> --contract gentle-ai.review-integration/v2 --agent opencode --next-transition=true --lineage=review-d0fef618d27025e0` y relanzar los 4 subagentes `review-*` copiando `provider_task.agent` y `provider_task.prompt` EXACTAMENTE. Via alternativa sin hook: `gentle-ai review capture-result --materialize` (imprime el task opaco materializado por Go) y `--preflight` / `--input` para enviar el resultado.

**Next step:** reanudar el review RDD (lineage `review-d0fef618d27025e0`) cuando el hook de transporte de OpenCode funcione, y setear las env vars pendientes antes del deploy.

## Env vars pendientes (setear en Render/Railway antes de deploy)

| Variable | Scope | Default | Notes |
|---|---|---|---|
| `TWILIO_AUTH_TOKEN` | webhook | — (required) | Sin valor el webhook rechaza todo con 403. |
| `INTERNAL_API_TOKEN` | `POST /api/ventas/pedido-libre` | — (required) | Sin valor el endpoint rechaza todo con 403. |
| `ADMIN_TOKEN` | `POST /api/admin/recargar-catalogo`, `POST /api/admin/job-contable` | — (required) | Bearer token, checked by `requireAdminToken`. **T5: `job-contable` también lo exige** (antes no pedía nada). |
| `RATE_LIMIT_WINDOW_MS` | rate limit | `900000` (15 min) | T4. Tamaño de la ventana de presupuesto. |
| `RATE_LIMIT_MAX` | rate limit | `60` | T4. Requests por ventana. `0` o un valor no entero hace fallar el arranque. |
| `CORS_ALLOWED_ORIGINS` | cors | — (fail closed) | T5. Lista de orígenes permitidos, separada por comas. **Sin valor: todo origen de navegador recibe 403.** Ej: `https://tu-frontend.vercel.app,http://localhost:5173`. |
| `ADMIN_ALLOWED_NUMBERS` | whatsapp/webhook allowlist | — (required, fail closed) | Mover la allowlist de hardcoded a env. Lista separada por comas, números en E.164. **Sin valor o vacío: nadie permitido, todo remitente recibe 403.** Sigue siendo la 2ª verificación que el número exista como admin en Firestore; sin filtros `Activo`/`Rol`. Ej: `+573138861417,+573213413474,+573203648967`. |

**D18 (2026-10-23) — Work unit 2 committed.** Commit `9e8811b` on `feat/backend-robustez`: `feat(auth): move whatsapp admin allowlist to ADMIN_ALLOWED_NUMBERS env var`. 6 files, +125/-8. Staged exactly: `backend/src/config.js`, `backend/src/whatsapp/index.js`, `backend/tests/unit/config.test.ts`, `backend/tests/unit/whatsapp/webhook.ratelimit.test.ts`, `backend/tests/unit/whatsapp/webhook.security.test.ts`, `odd/tasks/whatsapp-order-auth-hardening.md`. NOT staged (gentle-ai generated, out of scope): `.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`. Full suite re-run after commit: `npm run test:ci` → **250 passed (250 tests), 25 files** (unchanged from D17). Feature `whatsapp-order-auth-hardening` now **100% closed**: T1–T6 all done and verified, all work units committed.
