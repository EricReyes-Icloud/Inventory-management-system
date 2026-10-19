# Feature: seed-catalog-docid-fix

**Objective:** Stop `scripts/seed-sinonimos.js` from creating a second document per product
subcollection (the production blocker: price 0 on 18 products), make it merge onto the
existing document, and make it runnable from the repo root.
**Branch:** `feat/backend-robustez` (user-mandated — no new branch).
**Delivery strategy:** `ask-on-risk` (default). Push/PR remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest) — baseline 178 tests / 19 files.

## Specs

**S1 — The seed merges onto the existing document, never onto `.doc(product)`.**
Scope: `scripts/seed-sinonimos.js` write path.
Source (verbatim from the change record): "que el seed resuelva el docId existente (leer la
subcolección y mergear sobre `docs[0].id`), NO escribir `.doc(product)`".
Acceptance: for each of the 24 products the write targets the document that already exists in
`Productos/Productos_ID/{product}`. No document whose ID equals the product name is written.
Check: unit test asserting every write path is `Productos/Productos_ID/{product}/{existingId}`.

**S2 — The write path is testable and the merge target is pinned by a test.**
Source (verbatim): "test que verifique que mergea sobre el docId existente".
Acceptance: the write path accepts an injected `db`, so it can be exercised without Firestore;
the test fails against the pre-fix behaviour and passes after it.
Check: run the new tests; report observed RED then GREEN.

**S3 — The seed fails fast instead of guessing when a subcollection is empty or ambiguous.**
Acceptance: 0 documents → abort before any write; more than 1 document → abort before any
write. The error names the product and the document count.
Check: unit tests for both cases, plus an assertion that no write was attempted.

**S4 — Writes are committed atomically in a single batch.**
Acceptance: all 24 writes are collected in one `WriteBatch` and committed once, so a failure
leaves Firestore unchanged instead of half-seeded.
Check: unit test asserting exactly one commit and one `set` per product.

**S5 — Credentials come from the repo's canonical source.**
Acceptance: the seed authenticates with `backend/src/secrets/serviceAccountKey.json`, the same
file `backend/src/lib/firestore.js` already uses. No dependency on `GOOGLE_APPLICATION_CREDENTIALS`.
Check: code inspection; real execution is a separate, explicitly authorized step.

**S6 — `npm run seed:catalog` works from the repo root.**
Source (verbatim): "se agrega un script `npm run seed:catalog`".
Acceptance: `npm run seed:catalog -- --dry-run` runs from the root with no
`MODULE_NOT_FOUND` and without `NODE_PATH`.
Check: execute it and observe the 24/53/12 dry-run output.

**S7 — The script header documents the working commands.**
Source (verbatim): "el header del script documenta hoy un comando incompleto".
Acceptance: the header shows `npm run seed:catalog` and `npm run seed:catalog -- --dry-run`.
Check: read back the header.

**Assumptions (marked as assumptions):**
- Production currently has exactly one document per subcollection. Evidence: read-only
  inspection of `automatizacion-inventario-2504` recorded 2026-10-14 in the previous session.
  NOT re-verified in this session (no Firestore access authorized here).
- `backend/src/secrets/serviceAccountKey.json` exists in every environment that runs the seed.
  Verified present locally this session.

**Explicitly out of scope (separate changes):**
- Redesigning `docs[0]` so reader and writer stop depending on document-ID order (the
  change record's point 5).
- `ADMIN_TOKEN` in the root `.env` (point 4).
- The unguarded `POST /api/admin/job-contable` (point 6).
- Running the seed against production Firestore (point 7) — needs its own authorization.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S1,S2,S3,S4 | inline | Extract an injectable `seedCatalog(db, entries)` seam and write the write-path tests (RED) | ✅ | Seam at `scripts/seed-sinonimos.js:156-194`, exports at `:251-256`; RED observed twice by T6 (baseline `6 failed`, mutant `4 failed`) |
| T2 | S1,S3,S4 | inline | Rewrite the write path: resolve existing docId, guard empty/ambiguous, single atomic batch | ✅ | D9 — T6 verified S1/S3/S4 PASS; guarded aborts leave `refs.batchSet`/`refs.batchCommit` with zero calls |
| T3 | S5 | inline | Authenticate via `serviceAccountKey.json` and resolve backend modules explicitly | ✅ | D9 — `credential.cert(require(SERVICE_ACCOUNT_PATH))` at `scripts/seed-sinonimos.js:196-216` |
| T4 | S6,S7 | inline | Add `npm run seed:catalog` at root and fix the script header | ✅ | D9 — `npm run seed:catalog -- --dry-run` works from repo root and from an unrelated cwd; header at `:9-14` |
| T5 | all | inline | Full suite + real dry-run through the npm script | ✅ | D9/D10 — full suite 187/187 (20 files); dry-run byte-identical to baseline (24/53/12, exit 0) |
| T6 | all | delegated | Independent verification (high risk: writes production data) | ✅ | D9 — PASS, S1-S7 all PASS, 0 blockers, suite 184/184 |
| T7 | all | inline | Work-unit commit | ✅ | `5732bd9` `fix(scripts): merge seed catalog onto the existing product document` — 7 files, 562 insertions(+), 26 deletions(-) |
| T8 | S1,S3,S4 | inline | Adopt the verifier's independent regression suite (scope addition authorized by the maintainer after T6) | ✅ | 24/24 focused, 187/187 full suite, 20 files |

## Log

**L1 (user, verbatim):** "Hola, puedes leer la ultima session_summary por favor."

**L2 (user, verbatim):** "Si arranquemos por el punto 1."

**L3 (user, verbatim):** "Fix del seed + punto 3, pero quiero que lo hagas en esta misma rama,
no crees ninguna rama mas por favor."

**L4 (user, verbatim):** "Seguir en scripts/ + resolver backend (Recomendado)"

**D1 — Scope decision (2026-10-14).** The change record's point 1 asked "hotfix directo sobre
el seed ... vs proceso completo". Under the repo's AGENTS.md, SDD is prohibited, so "proceso
completo" no longer exists as an option; the real fork was Small/inline vs Large/tracked. This
is Large: high-risk item 1 (writes production Firestore) and item 6 (no test would catch a
regression — the `--dry-run` never touches Firestore, and the write path had zero coverage).
Hence this feature document plus an independent verifier.

**D2 — Classification evidence (2026-10-14).** Verified from the repository, not memory:
- `scripts/seed-sinonimos.js:131` writes `.collection(product).doc(product).set(...)`, creating
  a document whose ID is the product name (`"Aji * 100"`).
- `backend/src/repositories/productos.repository.js:73-83` (`buscarSubcoleccion`) and `:100`
  (`getCatalogo`) read `subcolSnap.docs[0]` with no `orderBy`. Firestore orders a query without
  `orderBy` by document ID ascending, so `"Aji * 100"` sorts before an existing `"Aji_1"`
  (`' '` = 0x20 < `'_'` = 0x5F). The reader would therefore pick the seed document, which
  carries no price fields → price 0. The reported blocker reproduces exactly.

**D3 — Branch base verified (2026-10-14).** PR #25 is merged into `develop` (`5837a97` merges
`f3f2754`), and `feat/backend-robustez` has no commits outside `develop`. The fix is additive
on top of an already-merged branch.

**D4 — Punto 3 approach (2026-10-14).** User chose: stay in `scripts/`, resolve the backend
workspace's modules explicitly, take credentials from `serviceAccountKey.json`, add the npm
script. Rejected alternatives and why:
- **Moving the script to `backend/scripts/`** would give native module resolution, but the user
  scoped this change tightly and the move churns the test path plus six `openspec/` references.
- **`NODE_PATH` in the npm script** is what the old runbook used, but it is Unix-only syntax and
  would need `cross-env`; it also puts a credential path inside `package.json`.
- **`dotenv` internally** was rejected on evidence: the root `.env` contains only
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID` and
  `FIREBASE_WEB_API_KEY`, none of which the seed reads. Loading dotenv would change nothing.

**D5 — Root cause of the escape (2026-10-14).** `backend/tests/unit/scripts/seed-sinonimos.test.ts`
(151 lines) covers only the snapshot maps and `dryRun()`. The write path was never exercised and
`executeSeed()` was not injectable, which is why the change's verify reported PASS WITH WARNINGS.

**D6 — Two additions beyond the literal request (2026-10-14), flagged for review.** Both exist to
make a one-time write against production safe, and both are reversible if the maintainer prefers
the literal minimum:
- **S3 (fail fast on 0 or >1 documents).** A one-time production migration that silently guesses
  is worse than one that refuses. This also prevents the *same* class of bug from recurring if a
  subcollection ever gains a second document.
- **S4 (single atomic batch).** The pre-read phase required to resolve doc IDs already runs before
  any write; collecting the 24 writes in one batch turns "half-seeded production" into
  "unchanged production" on failure. 24 operations is far under the 500-op batch limit.

**L7 (user, verbatim):** "Si relanza el T6."

**L8 (user, verbatim):** "Adoptemos ese archivo antes de T7"

**D10 — Adopted the verifier's independent regression suite (2026-10-19), T8.** The T6 verifier
proposed a separate suite pinning S1, S3 and S4; the maintainer chose to adopt it before the T7
commit. The proposal was written OUTSIDE the workspace and had never been executed, so it was
validated against the real helper API before being written to
`backend/tests/unit/scripts/seed-sinonimos.verify.test.ts`: `createMockDb` returns `{mockDb, refs}`
with `refs.batchSet`/`refs.batchCommit` spies (`firestoreMock.ts:258-283`), `buildMockStore`
accepts a `Scenario` with the new optional `products` key (`:379-431`), `DocSnapshot.ref.path`
exists (`:30-40`), and `seedCatalog` returns `plan.length` (`scripts/seed-sinonimos.js:154,193`)
with the exact error strings the regexes target (`:166-176`). It is not a duplicate of the
implementer's suite: it pins two acceptance criteria the implementer's did not — the abort error
must NAME THE PRODUCT and the DOCUMENT COUNT (the implementer only matched `/no documents/` and
`/more than one document/`, so dropping the product name would have passed), and no two writes may
target the same path. Observed: focused run `2 files / 24 tests passed`; full suite `npm run
test:ci` -> `20 passed (20)` files, `187 passed (187)` tests. No production file was touched by
this task, so its risk line is `Risk: none`.

**Next step:** T7 (work-unit commit) on `feat/backend-robustez`. T6 PASS (D9), T8 adopted (D10).
T1-T5 are done and green in the working tree; their checkboxes are closed now, with the T6 evidence
that actually proves each one.

**PRODUCTION SAFETY GATE:** this feature document authorizes code and tests only. Executing the
seed against Firestore is the change record's point 7 and requires its own explicit authorization.

**L5 (user, verbatim):** "Yo ya asigne un modelo a gentle-ai-verify, intentemos nuevamente
continuar desde ahi."

**L6 (user, verbatim):** "Si reordena la regla, pero no lances todavia la T6, solo reordena y
despues genera la session_summary porque te falta poco para compactarte."

**D7 — T6 blocker root cause found and fixed (2026-10-19).** The `permission.rejected` on the
`subagent` tool was NOT a missing model. OpenCode V2 resolves permissions through one ordered
`permissions` array with last-match-wins, and the V1-shaped map under
`agent.gentle-orchestrator.permission.task` normalizes in key order. `"*": "deny"` sat in the
middle, after the three `gentle-ai-*` allows, shadowing them; `explore`, `general`, `jd-*` and
`review-*` sit after it and kept working. Observed in the same session and runtime:
`subagent(gentle-ai-verify)` -> `permission.rejected`; `subagent(explore)` -> launched and
answered. Fix applied: `"*": "deny"` moved to first position; config JSON validated after the
edit. **NOT YET VERIFIED END TO END** — T6 was deliberately not relaunched, per L6. A restart of
the OpenCode service may be required before the change takes effect.

**D8 — Discarded cause.** `plugins/opencode-review-transport.ts` only intercepts `review-risk`,
`review-resilience`, `review-readability`, `review-reliability`, `review-refuter` and
`review-validator`; its refusal string is `opencode_review_transport_relay_refused`, not
`permission.rejected`.

**D9 — T6 independent verification: PASS (2026-10-19).** Verifier `gentle-ai-verify` launched
successfully after the D7 permission-ordering fix, so D7 is now confirmed end to end. All probes
ran in a scratch copy (`mktemp -d` under `/tmp/opencode`); the workspace `git status` was
byte-identical before and after, and the seed was never executed without `--dry-run`. Verdict per
spec: S1 PASS, S2 PASS, S3 PASS, S4 PASS, S5 PASS, S6 PASS, S7 PASS. Blockers: none. Commands
observed: `npm run test:ci` -> 184 passed / 19 files (baseline 178); `npm run seed:catalog --
--dry-run` from the scratch root and from an unrelated cwd -> `Would write 24 product documents` /
`Total synonyms: 53` / `Total categories: 12`, exit 0, output byte-identical to the baseline
dry-run; `git show f3f2754:scripts/seed-sinonimos.js` -> `:131 await
COLRef.collection(product).doc(product).set(` confirming the pre-fix bug. RED was observed twice,
not asserted: the new tests fail against the baseline script (`6 failed`, `script.seedCatalog is
not a function`) and against a mutant that reintroduces `.doc(product)` (`4 failed`, including
`expected [ ...(24) ] to include 'Productos/Productos_ID/Aji * 100/Aji_1'`). Advisories (none
blocking): the `SNAPSHOT_CATEGORIES` doc comment at `:85` says 11 while there are 12 (pre-existing
at `f3f2754`); a subcollection whose only document is named after the product would merge onto
`.../{product}/{product}`, a state no command in the repo can produce; the repository has no
`build` or typecheck script, so the new `Scenario.products` type is validated only by esbuild
transpilation; the empty-subcollection error states the count in words rather than as `0`; the new
`firestoreMock.ts:397-399` branch is additive and unused by pre-existing tests. T7 can proceed.

**Status at T7 commit (2026-10-19):** the work-unit commit on `feat/backend-robustez` carries the
seed merge fix, its guards and atomic batch, `npm run seed:catalog`, the two write-path suites
(implementer's and the adopted independent one), the mock helpers, and this document. Full suite
before the commit: 187/187 over 20 files. The seed has NEVER been executed against Firestore —
dry-run only, per the production safety gate below. The D7 permission fix is confirmed end to end.

**L9 (user, verbatim):** "Si solo haz T7 y despues ahi si te indico que sigue."

**D11 — T7 executed (2026-10-19).** T7 landed as `5732bd9ff4a250c8c3e2ea2f201a2fbada822845`,
`fix(scripts): merge seed catalog onto the existing product document`, 7 files staged, 562
insertions / 26 deletions. Staged exactly: `scripts/seed-sinonimos.js`,
`backend/tests/unit/scripts/seed-sinonimos.test.ts`,
`backend/tests/unit/scripts/seed-sinonimos.verify.test.ts`,
`backend/tests/helpers/firestoreMock.ts`, `backend/tests/helpers/firestoreMockTypes.ts`,
`package.json`, `odd/tasks/seed-catalog-docid-fix.md`. Deliberately NOT staged: `.atl/.skill-registry
.cache.json`, `.atl/skill-registry.md`, `AGENTS.md` — maintainer edits unrelated to this change.
Full suite before the commit: 20 files / 187 tests passing; after the commit, over the committed
tree: the same 187/187. T1-T5 checkboxes were closed here because D9's independent verification is
the evidence that proves each one. The maintainer authorized T7 alone (L9), so nothing else moved:
no push, no PR, no real seed run. **D6 is still unresolved:** the 0/`>1`-documents guard and the
single atomic batch go beyond the literal request and have not been reviewed explicitly by the
maintainer.
