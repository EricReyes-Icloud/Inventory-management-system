# Historial de Ganancias — Propuesta de interfaz

**Estado:** borrador base (no implementado)
**Fecha:** 2026-11-06
**Alcance:** pantalla de Ganancias de la aplicación móvil. El frontend es un repositorio externo a este; las referencias de código corresponden al backend.
**Relación:** deriva del mapa verificado del dominio de ganancias y de las decisiones ya tomadas en `docs/frontend/home-propose.md`.

---

## 0. Lo que el código permite (y lo que no)

| Hecho verificado | Evidencia | Consecuencia de diseño |
|---|---|---|
| `Ganancias/{mesAnio}` = **1 doc por mes**, categorías como campos | `contable.repository.js:93-95`, `ganancias.service.js:167` | El total del mes es **suma de categorías**. No existe un total a nivel doc: lo agrega el endpoint. |
| El cierre es **por categoría** (`POST /api/admin/cerrar-categoria`) | `admin.button.routes.js:19-56` | Un mes puede quedar a medio cerrar. Existe un tercer estado: **Parcial**. |
| Mes en curso vive en `Total Productos/{mesAnio}` y `Cartones_vendidos/{mesAnio}` con `estado:"abierto"` | `contabilidad.repository.js:135,149` | El "En curso" se lee de ahí, **no** de `Ganancias` (donde `estado` es siempre `"cerrado"`). |
| El cierre total **no es re-ejecutable**: `generarHistoricoMensual` lanza si ya existe el histórico | `contabilidad.service.js:27-30` | "Cerrar mes" es irrepetible: sin retry silencioso. |
| Al cerrar cada categoría **se borran los SKUs del mes** | `contable.repository.js:352-390` | El detalle llega hasta **categoría**. Por producto no es confiable en meses cerrados. |
| **Cero endpoints GET** de ganancias/ventas/histórico | rutas completas revisadas | La pantalla no existe sin contrato nuevo. |

**La decisión estructural:** la línea de tiempo es de **tres estados** — `Cerrado`, `Parcial`, `En curso` — no de dos. Modelarla como "cerrado / pendiente" produce una card que miente.

---

## 1. Anatomía

```
┌─────────────────────────────────────────┐
│ ←  Historial de Ganancias        [2026] │  título + filtro de año
│                                         │
│  Acumulado 2026        $ 14.820.000     │  resumen derivado del listado
│  6 meses cerrados · mejor: Julio        │  (sin endpoint extra)
├─────────────────────────────────────────┤
│ ○  EN CURSO                             │  nodo hueco · línea punteada
│ ╷ ┌─────────────────────────────────────┐
│ ╷ │ Noviembre 2026          [ En curso ]│
│ ╷ │ Ventas            $ 2.140.000       │
│ ╷ │ Cartones                  1.820     │
│ ╷ │ Cerrar mes                       →  │
│ ╷ └─────────────────────────────────────┘
│ ●  OCT                                 │  nodo lleno · línea sólida
│ ┃ ┌─────────────────────────────────────┐
│ ┃ │ Octubre 2026             [ Cerrado ]│
│ ┃ │ $ 1.284.500        ▲ 12,4% vs Sep   │
│ ┃ │ Ventas 3.420.000 − Inv. 2.135.500   │
│ ┃ │ Margen 37,6% · 2.950 cartones    ›  │
│ ┃ └─────────────────────────────────────┘
│ ●  SEP                                 │
│ ┃ ┌─────────────────────────────────────┐
│ ┃ │ Septiembre 2026        [ Parcial ]  │
│ ┃ │ $   980.000        ▲  6,1% vs Ago   │
│ ┃ │ 3 de 5 categorías cerradas          │
│ ┃ └─────────────────────────────────────┘
```

Reglas:

- **Línea a 24 px del borde**, nodo de 10 px, card a la derecha con 12 px de separación. La línea es un `border-left` de un contenedor por año, no un elemento que se corta entre cards.
- **Orden: más reciente arriba.** Historial = lo último primero.
- **Nodo = abreviatura del mes** (`OCT`), y el año aparece en el encabezado de la card. Un nodo extra por cambio de año hace de separador sticky (`2026`, `2025`).
- **Card de ~112-120 px** → 4 cards visibles en 360 px. Es un historial, no un dashboard.

---

## 2. La card

**Jerarquía, de arriba abajo:**

1. **Mes + estado** (16 px semibold / chip). El chip nunca depende solo del color: `Cerrado`, `Parcial`, `En curso` son texto.
2. **Ganancia neta** (26 px, `tabular-nums`). Es el protagonista único de la card.
3. **Delta vs mes anterior** — solo si existe mes anterior comparable. Nunca `0%` ficticio. Muestra signo + flecha + color, redundantes.
4. **Ecuación en una línea:** `Ventas 3.420.000 − Inv. 2.135.500`. Convierte la cifra en explicación.
5. **Margen · cartones** (12 px, muted) + chevron.

**Estado `Parcial`:** no muestra cifra de ganancia como si fuera final. Muestra el acumulado de lo cerrado y el conteo `3 de 5 categorías cerradas`. La cifra va con etiqueta `parcial`.

**Estado `En curso`:** ventas y cartones (que son hechos), **sin ganancia**. La inversión del mes en curso usa los costos fijos actuales, que cambian durante el mes → mostrar "ganancia estimada" sería inventar un número que se mueve solo. Mejor no mostrarlo.

**Mes con pérdida** (`gananciaNeta < 0`): `−$ 210.000` con el color de pérdida y chip `Pérdida`. Jamás ocultar. Un sistema contable que esconde los meses malos no sirve para decidir.

---

## 3. Línea de tiempo: mecánica

- **Ordenar por período ISO, no por `mesAnio`.** `"Abril" < "Agosto" < "Diciembre" < "Enero"` alfabéticamente: el listado saldría desordenado. El endpoint devuelve `periodo: "2026-10"` además de `mesAnio`, y se ordena por eso.
- **Paginación por cursor de período**, 12 meses por página. Un año entra en un fetch.
- **Filtro de año** en el título: `‹ 2026 ›`. Con dos años cargados deja de ser un scroll infinito sin contexto.
- **Resumen superior** (acumulado del año, cantidad de meses, mejor mes) se calcula en cliente sobre los meses ya cargados. Costo cero, y solo se muestra si hay al menos un mes cerrado.
- **El nodo no es táctil.** El target es la card completa (≥ 44 px). El chevron indica que hay proceso detrás.

---

## 4. Subprocesos por card — el corazón del pedido

Cada card abre **un proceso propio**, y cada subproceso tiene que estar respaldado por datos reales. Estado honesto:

| # | Subproceso | Qué responde | Fuente de dato | Estado |
|---|---|---|---|---|
| **M1** | **Resultado del mes** | ¿Cuánto se ganó y por qué? Hero con ecuación, margen, cartones, promedio por cartón | `Ganancias/{mes}` (suma de categorías) | ✅ listo con 1 endpoint |
| **M2** | **Desglose por categoría** | ¿Qué categoría sostiene el mes? Lista por categoría: venta, inversión, ganancia, margen, cartones | Campos por categoría en `Ganancias/{mes}` | ✅ listo, mismo endpoint |
| **M3** | **Costos e inversión** | ¿De dónde sale `inversionTotal`? Fijos unitarios, variables, fórmula aplicada | `Ganancias/{mes}` + `Invertir/{cat}/historico_compras/{mes}` | ⚠️ parcial |
| **M4** | **Comparar con el mes anterior** | ¿Mejoró o empeoró, y en qué categoría | Derivado de M1/M2, sin lectura extra | ✅ gratis |
| **M5** | **Pedidos del mes** | ¿De dónde salió esa venta? Pedidos agrupados por cliente | `Ventas/{clienteId}/Pedidos/{mes}/pedidos` — **requiere collectionGroup nuevo** | ❌ no existe |
| **M6** | **Cerrar mes** (solo `Parcial`/`En curso`) | Ejecutar el cierre que falta | `POST /api/admin/cerrar-mes` / `cerrar-categoria` | ✅ existe, destructivo |

**Recomendación de alcance:**

- **v1** = M1 + M2 + M4. Es el 80 % del valor, un solo endpoint, y no inventa nada.
- **v1.1** = M3, cuando el endpoint de histórico de compras por mes exista.
- **v2** = M5. Hoy requeriría leer N clientes o un `collectionGroup` filtrado por mes que no está escrito. Es el subproceso más caro y el que más justifica una iteración aparte.
- **M6 no es un subproceso del historial.** Vive solo en la card `En curso` y `Parcial`, como acción administrativa con confirmación explícita. Un historial es consulta; cerrar el mes es una operación irreversible.

**Diseño del subproceso:** pantalla completa en `/ganancias/:mesAnio`, **no** bottom sheet. Tiene hero + lista de categorías + (futuro) pedidos: un sheet trunca justo el dato que se fue a buscar. Dentro, un solo scroll con secciones, sin tabs: sin estado oculto y sin obligar a descubrir pestañas.

---

## 5. Estados, carga y error

- **Skeleton con la forma de la card** (mes, cifra, ecuación). Sin spinner: el salto de layout sobre un número de dinero destruye la confianza.
- **Vacío real:** `Todavía no cerraste ningún mes` + CTA `Cerrar mes`. Es el primer arranque del sistema, no un error.
- **Error:** si falla el listado, pantalla completa con `Reintentar`. Si falla una sección del detalle, esa sección falla sola y el resto sigue visible.
- **`prefers-reduced-motion`** respetado. La única animación justificable: el conteo ascendente de la cifra al montar, 400 ms.

---

## 6. Contrato backend mínimo (para que esto exista)

Todo bajo `adminAuth` (`middlewares/adminAuth.js:25-79`):

**1. `GET /api/admin/ganancias?anio=2026&limit=12&cursor=2026-09`**

```json
{
  "periodo": "2026-10",
  "mesAnio": "Octubre 2026",
  "estado": "cerrado | parcial | en_curso",
  "gananciaNeta": 1284500,
  "ventaTotal": 3420000,
  "inversionTotal": 2135500,
  "cartones": 2950,
  "categoriasCerradas": 5,
  "categoriasEsperadas": 5
}
```

El servidor ordena por período y agrega la suma de categorías. El cliente no suma dinero.

**2. `GET /api/admin/ganancias/:mesAnio`**
→ categorías completas + `inversionTotal` desglosada (`costosFijosUnit`, `costosVariablesUnit`, `cartones`) + `periodoAnterior` comparable.

**3. (v2) `GET /api/admin/pedidos?mesAnio=`** → pedidos del mes agrupables por cliente.

Es **contrato nuevo consumido por el frontend + superficie de autenticación ampliada** → alto riesgo, va con revisión, no implementación directa.

---

## 7. Riesgos que harían mentir a la pantalla

Estos no son detalles de estilo; son números incorrectos en pantalla:

1. **Miel puede mostrar `inversionTotal: 0`.** `cerrarGananciasPorCategoria` lee `categoriaVentas.productos`, pero `generarHistoricoMensual` persiste `skus` (`ganancias.service.js:85-88` vs `contabilidad.service.js:41-51`). El resultado es una ganancia inflada y una card que se ve perfecta. **Hay que verificarlo antes de construir la pantalla.**
2. **`mesAnio` tiene dos formatos:** `"Septiembre 2025"` vs `"Septiembre de 2025"` (`ventas.service.js:237-241`). Si los pedidos se guardan con "de", M5 nunca encuentra ese mes. La clave del endpoint debe ser única y validada.
3. **No hay redondeo en toda la ruta de dinero.** Sumar categorías va a arrastrar `1284500.0000000002`. Redondear en presentación, una sola vez, con `Intl.NumberFormat`.
4. **`Cerrar mes` no se puede reintentar** (`Historico_Mensual` ya existe → throw). El CTA necesita manejar ese error con un mensaje real, no un retry ciego.

---

## 8. Decisiones abiertas

| # | Decisión | Impacto |
|---|---|---|
| G1 | ¿M6 "Cerrar mes" vive en esta pantalla o solo en administración? | Cambia si la card `En curso` tiene CTA |
| G2 | ¿M5 pedidos entra en v1 o v1.1? | Define si el detalle tiene sección de pedidos |
| G3 | Moneda y formato (heredado de D1 del home) | Afecta cada importe |
| G4 | ¿Qué categoría se considera "esperada" para detectar `Parcial`? | Catálogo `Invertir` vs categorías del mes |
