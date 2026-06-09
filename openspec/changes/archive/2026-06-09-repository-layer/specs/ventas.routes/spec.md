# Delta for ventas.routes

## REMOVED Requirements

### Requirement: POST /calcular-ganancias Endpoint

(Reason: The endpoint imports `calcularGananciasInterno` which was never exported from `ganancias.service.js` — the only export is `cerrarGananciasPorCategoria`. This endpoint has never worked. The earnings calculation is handled by the orchestrator pipeline and admin route.)
(Migration: Delete the route handler at `routes/ventas.js` lines 219-231 and its inline `require` call.)

#### Scenario: Endpoint no longer exists

- GIVEN a POST to `/calcular-ganancias`
- WHEN Express resolves the route
- THEN the response SHALL be 404 (no matching route)
- AND the module SHALL NOT import `calcularGananciasInterno`

## MODIFIED Requirements

None.
