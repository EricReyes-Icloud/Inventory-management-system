# Proposal: Repository Layer Introduction

## Intent

Introduce a repository layer to abstract Firestore access, replacing direct `require("../lib/firestore")` calls in services and routes. This improves testability, separates concerns, and prepares for future database changes.

## Scope

### In Scope
- Create 5 repository files: contabilidad.repository.js, ventas.repository.js, productos.repository.js, contable.repository.js, admin.repository.js
- Migrate contabilidad.service.js to use contabilidad.repository.js (pilot)
- Define repository interfaces matching current Firestore usage patterns
- Maintain backward compatibility during incremental migration

### Out of Scope
- Migrating all services in this change (will be done incrementally)
- Changing Firestore data model or collection structure
- Introducing ORM or query builders (keeping raw Firestore SDK)
- Modifying business logic in services (only data access layer)

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach

Create functional repositories (CommonJS modules) that encapsulate Firestore operations. Each repository exposes methods matching current service needs. Start with contabilidad.repository.js as pilot, then migrate services one-by-one while keeping old and new code coexisting via service-layer delegation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/firestore.js` | Modified | Export initialized Firestore instance for repository use |
| `src/services/contabilidad.service.js` | Modified | Pilot: replace direct DB calls with repository methods |
| `src/repositories/contabilidad.repository.js` | New | Pilot repository for accounting domain |
| `src/repositories/ventas.repository.js` | New | Sales domain repository |
| `src/repositories/productos.repository.js` | New | Products domain repository |
| `src/repositories/contable.repository.js` | New | Contabilidad domain repository |
| `src/repositories/admin.repository.js` | New | Admin domain repository |
| `src/services/*.service.js` | Future | Will be migrated in subsequent changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Batch operations lose atomicity | Medium | Use Firestore batches in repository methods, maintain transactional behavior |
| Circular dependencies between repositories | Low | Keep repositories focused on single domain, avoid cross-repo calls |
| Subcollection path errors | Medium | Centralize path building in repository helpers, add path validation |
| Test breakage during migration | High | Use Vitest mocking for repository layer, keep old service tests until migration complete |
| Performance regression | Low | Benchmark critical paths, maintain same Firestore call patterns |

## Rollback Plan

Delete created repository files, revert contabilidad.service.js to original state, and restore direct Firestore imports. Since migration is incremental and services retain old code during transition, rollback is surgical per-file.

## Success Criteria

- [ ] contabilidad.service.js passes all existing tests using repository
- [ ] contabilidad.repository.js has 80%+ test coverage for public methods
- [ ] No Firestore API changes in service logic (same data outcomes)
- [ ] Repository methods are pure functions with explicit dependencies
- [ ] Pilot migration completes without blocking development