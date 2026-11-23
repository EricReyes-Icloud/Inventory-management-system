# Home — Propuesta de interfaz

**Estado:** borrador base (no implementado)
**Fecha:** 2026-11-05
**Alcance:** pantalla principal de la aplicación móvil. El frontend es un repositorio externo a este; las referencias de código de este documento corresponden al backend.
**Nota:** este documento no incorpora el pivote hacia una interfaz minimalista centrada en ganancias y flujo de pedidos/ventas. Queda como línea base para esa revisión.

---

## 0. Contexto verificado

La propuesta parte del modelo de datos real, no de supuestos de diseño.

| Hecho | Evidencia |
|---|---|
| `Ganancias/{mesAnio}` se escribe únicamente al cerrar el mes, por categoría. | `backend/src/services/ganancias.service.js:150-161` |
| Campos disponibles: `ventaTotal`, `cartones`, `costosFijosUnit`, `costosVariablesUnit`, `inversionTotal`, `gananciaNeta`, `estado`, `fechaCierre`. | `backend/src/services/ganancias.service.js:150-161` |
| `gananciaNeta = ventaTotal - inversionTotal`. | `backend/src/services/ganancias.service.js:148` |
| El período es `"Mes AAAA"` en español (`"Septiembre 2025"`). | `backend/src/utils/fechas.js:8-12` |
| Los pedidos viven anidados por cliente: `Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}`. | `docs/database/database_schema.md:28` |
| No existe ningún endpoint `GET` de ganancias, ventas o histórico: el dato financiero es *write-only*. | `backend/src/index.js:56-65` |
| La moneda es un `Number` crudo; no hay símbolo ni helper de formato. | modelo de datos, sin helper asociado |

**Consecuencia de diseño:** la pantalla principal es un tablero de **mes cerrado**, no un contador en vivo. Modelarla como "cuánto se ganó hoy" produce pantallas vacías o cifras inventadas.

---

## 1. Navegación inferior

Cuatro destinos más el FAB central.

| Slot | Label | Ícono (Lucide) | Trabajo que resuelve | Respaldo en el dominio |
|---|---|---|---|---|
| 1 | **Inicio** | `House` | Estado del negocio de un vistazo | — |
| 2 | **Productos** | `Package` | Precios, costos, stock, reposición | `GET /api/productos` (`backend/src/routes/productos.js:7-15`) |
| 3 | **+** (FAB) | `Plus` | Registrar pedido | acción primaria del sistema |
| 4 | **Ganancias** | `TrendingUp` | Cierres mensuales y resultado por categoría | colección `Ganancias` |
| 5 | **Clientes** | `Users` | Quién compra, historial, contacto | pedidos anidados en `Ventas/{clienteId}/Pedidos` |

**Por qué Clientes y no Pedidos:** los pedidos ya viven dentro de cada cliente en Firestore, y la pantalla principal muestra actividad reciente. Un listado global de pedidos duplica esa información en un quinto lugar. Clientes es una superficie sin entrada actual y concentra el valor de recompra y el seguimiento por WhatsApp.

**Bifurcación única:** si el negocio no gestiona clientes dentro de la aplicación, el reemplazo natural es **Pedidos**. Los demás slots no se modifican.

---

## 2. Anatomía de la pantalla principal

Orden de arriba hacia abajo.

### 2.1 Barra de contexto

No es un header grande. Contiene:

- Saludo: `"Buen día, {nombre}"`.
- A la derecha, un **chip de período**: `Septiembre 2025 ▾`.

Es la decisión de arquitectura de información más importante de la pantalla. Todo el dato financiero está particionado por `mesAnio` y existe solo para meses cerrados, por lo que el período no puede quedar escondido en un filtro: debe ser un control de primer nivel, visible y cambiable.

**Valor por defecto: el último mes cerrado.** No el mes actual, que está vacío por diseño del backend.

### 2.2 Hero financiero

La tarjeta de mayor tamaño y la única que puede ocupar ese lugar.

```
┌─────────────────────────────────────┐
│  Ganancia neta · Septiembre 2025    │
│                                     │
│           $ 1.284.500               │  ← 40–44px, tabular-nums
│           ▲ 12,4% vs Agosto         │
│                                     │
│  Ventas          Inversión          │
│  $ 3.420.000     $ 2.135.500        │
│  ─────────────────────────────────  │  ← ecuación visible
│  3.420.000 − 2.135.500 = 1.284.500  │
└─────────────────────────────────────┘
```

Reglas:

1. **La ecuación se muestra.** Una cifra de ganancia aislada no es interpretable. Ventas e inversión al lado convierten la tarjeta en una explicación: "se ganó esto porque se vendió tanto y se invirtió tanto".
2. **El delta solo aparece si existe un mes anterior comparable.** Sin `Ganancias` previa, la fila se omite. Nunca un `0%` ficticio.
3. **Mes abierto = estado distinto.** El hero muestra `"Septiembre 2025 · En curso"`, sin cifra de ganancia, con un CTA `Cerrar mes`. Es el único punto donde la pantalla principal empuja una acción administrativa.

### 2.3 Fila de KPIs

Tres indicadores, no seis.

| KPI | Cálculo | Motivo |
|---|---|---|
| **Cartones vendidos** | `cartones` de `Ganancias` | unidad de volumen del negocio |
| **Margen** | `gananciaNeta / ventaTotal` | indica si el precio está bien posicionado |
| **Promedio por cartón** | `ventaTotal / cartones` | detecta venta a precio bajo |

Los tres derivan de campos existentes. No requieren cálculos nuevos en el backend.

### 2.4 Ventas por categoría

Barras horizontales, una por categoría del mes, ordenadas por `ventaTotal` descendente.

`Ganancias` ya está estructurada por categoría, de modo que el dato nace en esa forma. Se usan barras y no torta: se comparan longitudes en vez de ángulos y se leen correctamente en 360 px de ancho.

### 2.5 Últimos pedidos

Máximo cinco ítems: cliente, producto, cartones, total y hora relativa. Sin paginación, con acción `Ver todos`.

### 2.6 Alerta de stock crítico

Un solo renglón colapsado al final: `⚠ 4 productos por reponer →`. No es una sección. Si no hay alertas, no se renderiza.

**No se incluye un grid de acciones rápidas.** Con el FAB y los cuatro destinos la cobertura está completa; un quinto punto de entrada para "Registrar pedido" compite con el FAB y le resta jerarquía.

---

## 3. Reglas de diseño financiero

- **Números tabulares siempre** (`font-variant-numeric: tabular-nums`). Sin esto las cifras cambian de ancho al actualizarse.
- **Moneda formateada con `Intl.NumberFormat`**, nunca con `toFixed` manual. La moneda debe decidirse una vez y centralizarse en un único helper usado por toda la aplicación.
- **Importes alineados a la derecha** en columnas; texto a la izquierda.
- **El color no codifica por sí solo.** Ganancia positiva o negativa lleva signo (`+`/`−`) e ícono además del color, por daltonismo y por lectura bajo luz solar directa.
- **Skeletons con la forma final, no spinners.** La tarjeta de ganancia reserva su altura antes del fetch; un salto de layout deteriora la confianza en el número.
- **Errores por tarjeta, no de pantalla completa.** Si falla "últimos pedidos", la ganancia sigue visible.
- **Estados vacíos de primera clase:** sin meses cerrados, mes sin pedidos, sin stock crítico. Cada uno con copy propio y una acción concreta.
- **Áreas táctiles de al menos 44 px**, FAB de 56–64 px y `env(safe-area-inset-bottom)` en la barra inferior. En iOS el FAB interfiere con el gesto nativo si no se respeta el inset.
- **`prefers-reduced-motion` respetado.** La única animación justificada es un conteo ascendente de 400 ms en el hero, al montar.

---

## 4. Requerimientos de backend

Para que esta pantalla exista se necesitan cuatro endpoints de solo lectura, todos protegidos con el middleware `adminAuth` existente (`backend/src/middlewares/adminAuth.js:25-79`):

1. `GET /api/dashboard?mesAnio=` — payload único de la pantalla, para evitar cinco round-trips en red móvil.
2. `GET /api/ganancias?meses=6` — serie para el sparkline y para los deltas.
3. `GET /api/pedidos/recientes?limit=5`
4. `GET /api/productos/stock-bajo`

Es trabajo de **alto riesgo**: introduce contrato nuevo consumido por el frontend y amplía la superficie de autenticación. Requiere revisión, no implementación directa.

---

## 5. Anti-patrones descartados

- Carrusel, degradados generalizados, glassmorphism. Es una aplicación de dinero: la legibilidad manda.
- Gráfico de torta.
- "Ganancia de hoy" si el backend no puede sostenerlo.
- Seis tarjetas de KPI. Tres, y legibles sin scroll.
- Cifra de ganancia simultánea en la barra superior y en el hero. Un solo lugar para el número protagonista.

---

## 6. Decisiones abiertas

| # | Decisión | Impacto |
|---|---|---|
| D1 | Moneda y formato (símbolo, separadores, decimales) | Afecta todo importe de la aplicación |
| D2 | Ubicación y stack del repositorio de frontend | Define componentes y tokens reutilizables |
| D3 | Clientes vs. Pedidos como quinto destino | Cambia la navegación inferior |
| D4 | Umbral de stock crítico y su origen de dato | Habilita o descarta la sección 2.6 |
| D5 | Comportamiento del período cuando no existe ningún mes cerrado | Primer arranque del sistema |

---

## 7. Criterios de aceptación

La pantalla se considera completa cuando:

- [ ] El período por defecto es el último mes cerrado y es visible y modificable.
- [ ] El hero muestra la ecuación `Ventas − Inversión = Ganancia` con importes formateados.
- [ ] Un mes abierto muestra el estado "En curso" con CTA `Cerrar mes`, sin cifra de ganancia.
- [ ] El delta se omite cuando no hay mes anterior comparable.
- [ ] Los tres KPIs se calculan con campos existentes y se leen sin scroll en 360 px.
- [ ] Existen estados de carga (skeleton), vacío y error para cada sección.
- [ ] Todos los importes usan `tabular-nums` y el helper único de formato.
- [ ] La barra inferior respeta `safe-area-inset-bottom` y las áreas táctiles son de al menos 44 px.
- [ ] Ningún elemento depende exclusivamente del color para transmitir significado.
