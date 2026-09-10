# Estrategia de Testing

## Objetivo

Este documento explica la estrategia de testing automatizado del proyecto. Está pensado como guía educativa para que entiendas qué cubre cada tipo de test y por qué es importante para la integridad del sistema.

---

## Cómo ejecutar los tests

```bash
# Ejecutar toda la suite
npm test

# Ejecutar en modo CI (sin watch)
npm run test:ci

# Ejecutar un archivo específico
npx vitest run tests/unit/utils/normalizarTexto.test.ts
```

---

## Estructura de la suite

```text
backend/tests/
├── unit/                  # Tests unitarios aislados
│   ├── utils/             # Utilidades compartidas
│   ├── services/          # Lógica de negocio
│   ├── job/               # Reglas del job contable
│   └── repositories/      # Capa de acceso a datos
├── integration/           # Tests de integración con mocks
├── flow/                  # Tests de flujo completo
└── helpers/               # Infraestructura compartida de testing
```

Cada categoría tiene un propósito específico y valida un nivel diferente del sistema.

---

## Unit Tests — Utils

Vas a encontrar dos archivos de test en esta categoría:

### `normalizarTexto.test.ts`

Este test valida la función `normalizarTexto`, que es la base del sistema de interpretación de pedidos. Lo que cubre:

- Conversión a minúsculas y eliminación de tildes
- Limpieza de caracteres especiales
- Conversión de plurales a singular
- Transformación de `"de"` → `"*"` (para matching posterior)
- Manejo de inputs inválidos (strings vacíos, null, undefined)

**Por qué importa**: Si `normalizarTexto` falla, todo el pipeline de interpretación NLP se rompe. Este test protege la entrada más crítica del sistema.

### `obtenerCategoria.test.ts`

Valida la función `obtenerCategoria`, encargada de clasificar productos en categorías. Cubre:

- Identificación correcta de categorías
- Insensibilidad a mayúsculas y tildes
- Diferenciación entre categorías similares (ej: `Canela` vs `Canela_molida`)
- Casos reales del negocio (pedidos tipo WhatsApp)
- Manejo de productos desconocidos
- Edge cases (strings vacíos, inválidos)

**Por qué importa**: La clasificación incorrecta de productos afecta directamente los cálculos contables y el inventario.

---

## Unit Tests — Services

Los services contienen la lógica de negocio crítica. Los tests de esta categoría validan cálculos financieros y operaciones contables.

### `contabilidad.service.test.ts`

Valida el servicio de contabilidad:

- Procesamiento de totales y cartones
- Suma correcta de subtotales
- Incremento correcto de cartones
- Agrupación por categoría y SKU
- Validación de inputs inválidos

**Por qué importa**: Un error en contabilidad afecta directamente los reportes financieros del negocio.

### `ganancias.service.test.ts`

Valida el cálculo de ganancias:

- Cálculo correcto de ganancias por producto
- Manejo de precios y costos
- Validación de datos incompletos

**Por qué importa**: Las ganancias son el indicador más importante para el negocio. Un error aquí tiene impacto directo en la toma de decisiones.

### `monthlyClosing.service.test.ts`

Valida el proceso de cierre mensual:

- Consolidación de datos del mes
- Actualización de históricos
- Validación de estados previos al cierre

**Por qué importa**: El cierre mensual es irreversible en el contexto del negocio. Debe ejecutarse correctamente la primera vez.

---

## Unit Tests — Jobs

### `jobContable.rules.test.ts`

Valida las reglas del job contable:

- No procesar pedidos no pagados
- No procesar pedidos ya contabilizados
- Procesar solo pedidos con `estadoContable = pendiente`
- Validar estructura de `detalle`
- Validar `fechaPedido`
- Cambiar estado correctamente: `pendiente` → `procesado`

**Por qué importa**: El job contable es un proceso automático que ejecuta operaciones críticas. Si sus reglas fallan, se procesan pedidos que no deberían o se saltan pedidos que sí deberían procesarse.

---

## Unit Tests — Repositories

Vas a encontrar 5 archivos de test para la capa de repositories:

### `admin.repository.test.ts`

Valida operaciones de administración sobre Firestore.

### `contabilidad.repository.test.ts`

Valida operaciones contables: obtener datos, ejecutar batch, limpiar categorías.

### `contable.repository.test.ts`

Valida las operaciones del repository contable: build de operaciones, ejecución de batch.

### `productos.repository.test.ts`

Valida el acceso a datos de productos.

### `ventas.repository.test.ts`

Valida el acceso a datos de ventas.

**Por qué importa**: Los repositories desacoplan la lógica de negocio del acceso a Firestore. Testearlos asegura que las operaciones CRUD funcionan correctamente de forma aislada.

---

## Integration Tests

Los tests de integración validan endpoints completos con Firestore mockeado.

### `ventas.test.ts`

Valida el endpoint `POST /pedido-libre`:

- Cliente válido / inválido
- Mensaje válido / inválido
- Flujo completo de creación de pedido
- Validación de respuestas HTTP

**Por qué importa**: Este es el endpoint principal del sistema. Si falla, los pedidos no se registran.

### `jobContable.test.ts`

Valida la ejecución del job contable sobre datos simulados:

- Procesa pedidos pendientes correctamente
- No procesa pedidos no pagados
- No reprocesa pedidos ya contabilizados
- Actualiza estado a `procesado` con `contabilidadAplicada = true`
- Llama correctamente a `procesarTotalesYCartones`

**Por qué importa**: El job contable se ejecuta de forma automática. Un error aquí afecta todo el procesamiento contable del sistema.

---

## Flow Tests

### `flujoCompleto.test.ts`

Simula el flujo completo del sistema:

```text
mensaje → inturis → ventas → Firestore → jobContable → contabilidad
```

Valida:

- Pedido se crea correctamente
- Pedido pasa a estado "pendiente"
- Job lo procesa correctamente
- Totales se reflejan en Firestore

**Por qué importa**: Este test valida que todas las piezas del sistema trabajan juntas correctamente. Es el nivel más alto de confianza antes de producción.

---

## Helpers

### `firestoreMock.ts`

Mock compartido de Firestore. Permite simular operaciones de base de datos sin conectar a un servicio real.

### `paths.ts`

Utilidades de paths para tests. Centraliza rutas de archivos de test y configuración.

**Por qué importa**: La infraestructura compartida mantiene los tests consistentes y evita duplicación de configuración.

---

## CI/CD

El proyecto utiliza GitHub Actions para integración continua.

### Workflow

- Archivo: `.github/workflows/ci.yml`
- Ejecución: en cada Pull Request y push a `main` / `develop`
- Entorno: Node.js 22
- Comandos: `npm ci` + `npm run test:ci`

### Qué valida

- Todos los tests pasan correctamente
- No hay errores de compilación
- La suite completa se ejecuta sin timeouts

### Gate de PR

Los Pull Requests no se pueden mergear si los tests no pasan. Esto garantiza que cada cambio llega a `main` con validación automática.

---

## Qué NO testear

Algunas áreas no requieren testing de nuestra parte:

- Firestore SDK interno (dependencia externa)
- Express internals (dependencia externa)
- Console logs
- Librerías externas

Solo testear nuestra lógica de negocio.

---

## Uso de IA en testing

La IA se utiliza como herramienta de soporte:

- Generar casos edge automáticamente
- Detectar escenarios no cubiertos
- Revisar lógica antes de merge

Las decisiones de testing siempre son supervisadas humanamente.
