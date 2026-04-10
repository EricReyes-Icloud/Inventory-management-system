# Testing Strategy — Sistema Contable (Condimentos El Colibrí)

## Objetivo

Garantizar la calidad, consistencia y confiabilidad del sistema contable mediante pruebas automatizadas que cubran:

- Normalización de texto
- Clasificación de productos
- Procesamiento contable
- Flujo completo desde pedido → contabilidad

---

# Qué ya está testeado

## 1. Unit Tests — Utils

### 🔹 normalizarTexto
Archivo: `tests/unit/utils/normalizarTexto.test.ts`

✔ Cobertura:
- Minúsculas y eliminación de tildes
- Eliminación de caracteres especiales
- Conversión de plurales a singular
- Transformación de `"de"` → `"*"`
- Limpieza de espacios
- Manejo de inputs inválidos

Resultado:
Función validada como base del sistema de interpretación

---

### 🔹 obtenerCategoria
Archivo: `tests/unit/utils/obtenerCategoria.test.ts`

✔ Cobertura:
- Identificación de categorías correctas
- Insensibilidad a mayúsculas y tildes
- Diferenciación entre categorías similares (ej: `Canela` vs `Canela_molida`)
- Casos reales del negocio (pedidos tipo WhatsApp)
- Manejo de productos desconocidos
- Edge cases (strings vacíos, inválidos)

  Mejoras implementadas:
- Reemplazo de `startsWith` → `includes`
- Ordenamiento por longitud (prioridad a categorías más específicas)
- Normalización de `_` → espacio para compatibilidad semántica

Resultado:
Clasificación robusta de productos basada en lenguaje natural

---

# Decisiones clave de arquitectura

## 1. Single Source of Truth

- `normalizarTexto` centralizada en:
- Eliminación de funciones duplicadas en services

---

## 2. Separación de responsabilidades

Funciones separadas según contexto:

- `normalizarTexto` → productos (NLP ligero)
- `normalizarCliente` → clientes (búsqueda exacta)

No mezclar ambas

---

## 3. Clasificación flexible (NLP básico)

- Matching por contenido (`includes`)
- No dependiente del orden del texto
- Soporte para lenguaje natural real

---

## 4. Testing basado en negocio

Los tests no validan solo código, validan:

- comportamiento real del usuario
- flujo de datos
- impacto en contabilidad

---

# Qué falta testear

## PRIORIDAD 1 — Reglas del Job Contable

Archivo objetivo: `tests/unit/job/jobContable.rules.test.ts`

### Tests a crear:

- No procesar pedidos no pagados
- No procesar pedidos ya contabilizados
- Procesar solo pedidos con `estadoContable = pendiente`
- Validar estructura de `detalle`
- Validar `fechaPedido`
- Cambiar estado correctamente:
  - `pendiente` → `procesado`
  - `contabilidadAplicada = true`

Objetivo:
Proteger la lógica crítica de negocio

---

## PRIORIDAD 2 — Services (contabilidad)

Archivo: `tests/unit/services/contabilidad.test.ts`

### Tests:

- `procesarTotalesYCartones`
  - Suma correcta de subtotales
  - Incremento correcto de cartones
  - Agrupación por categoría y SKU
- Validación de inputs inválidos

Objetivo:
Garantizar integridad financiera

---

## PRIORIDAD 3 — Integration Tests

Archivos: `tests/integration/ventas.test.ts`

### Tests:

- POST `/pedido-libre`
  - Cliente válido / inválido
  - Mensaje válido / inválido
  - Flujo completo de creación de pedido
- Validación de respuestas HTTP

Objetivo:
Validar endpoints reales

---

Archivos: `tests/integration/jobContable.test.ts`

### Tests:

- Procesa pedidos pendientes correctamente
- No procesa pedidos no pagados
- No reprocesa pedidos ya contabilizados
- Actualiza estado:
  - `estadoContable = procesado`
  - `contabilidadAplicada = true`
- Llama correctamente a `procesarTotalesYCartones`

Objetivo:
Validar la ejecución real del job sobre datos (simulación de Firestore)


## PRIORIDAD 4 — Flow Tests (End-to-End lógico)

Archivos: `tests/flow/flujoCompleto.test.ts`

Flujo completo:

       mensaje → inturis → ventas → Firestore → jobContable → contabilidad


### Validar:

- Pedido se crea correctamente
- Pedido pasa a estado "pendiente"
- Job lo procesa correctamente
- Totales se reflejan en Firestore

Objetivo:
Simular comportamiento real del sistema

---

# Qué NO testear (para no perder tiempo)

- Firestore SDK interno
- Express internals
- Console logs
- Librerías externas

Solo testear nuestra lógica

---

# Uso de IA en testing

Se utilizará IA para:

- Generar casos edge automáticamente
- Detectar escenarios no cubiertos
- Revisar lógica antes de merge (GitHub + Copilot)

---

# CI/CD (futuro cercano)

Se integrará:

- GitHub Actions
- Ejecución automática de tests en cada push
- Validación antes de merge a `main`

---

# Estado actual

```diff
+ Unit Tests (utils) → COMPLETADO
- Job Contable → PENDIENTE
- Services → PENDIENTE
- Integration → PENDIENTE
- Flow → PENDIENTE