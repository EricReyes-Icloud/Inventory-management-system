# Exploration: catalog-single-source

> Exploración de la deuda técnica "el catálogo vive en tres lugares" (Fase 6 — robustez del backend).
> Método: lectura de código real + sonda de solo lectura contra Firestore de producción (Admin SDK, 43 reads, sin escrituras) + ejecución de `interpretarPedido` y `obtenerCategoria` contra el código real.
> Fecha: 2026-09-11 · Rama: `feat/backend-robustez`

---

## 1. Inventario de las copias del catálogo

### Copia A — Firestore (`Productos/Productos_ID/{subcoleccion}/{docId}`)

- **Lectura**: `backend/src/repositories/productos.repository.js` (getProducto L31-40, getAllProductos L46-66, buscarSubcoleccion L73-83).
- **Estructura real (verificada con sonda a producción)**:
  - 24 subcolecciones bajo `Productos/Productos_ID`, **exactamente 24**.
  - El **nombre de la subcolección ES el nombre canónico** del producto (p.ej. `"Clavo * 100"`).
  - Cada subcolección tiene **1 documento** (el SKU), con **exactamente 4 campos**: `Precio carton`, `Precio unidad`, `Peso unidad`, `Precio a dar tienda`.
  - Ejemplos: `Clavo * 100` → `Clavo_1` (`Precio carton: 18000`), `Miel jumbo * 50` → `Miel_1` (`17500`), `Canela * 50 grande` → `Canela_4` (`31000`).
- **Consumidores**: `routes/ventas.js` (buscarSubcoleccion L64 + getProducto L106 + `p["Precio carton"]` L114) y `routes/productos.js` (GET `/api/productos` → getAllProductos, devuelve `{id, subcolecciones}`).

### Copia B — `productosOriginales` en `backend/src/brain/inturis.js` (L31-56)

- **24 strings**, idénticos a los nombres de subcolección de Firestore **1:1** (verificado contra producción). Incluye el typo `"Canela molidad * 100"` (L42), que **también existe en Firestore**.
- Se usa para construir el índice Fuse en tiempo de carga del módulo (L168-177).

### Copia C — `equivalencias` en `backend/src/brain/inturis.js` (L61-162)

- **53 mapeos** de sinónimo normalizado → nombre canónico.
- Todos los targets existen en `productosOriginales` (verificado programáticamente).
- Distribución: 1 a 5 sinónimos por producto. Los más cargados: `Clavo * 100` (5), `Aji * 100` (4), `Aji * 50` (3), `Ajo en polvo * 50` (3), `Clavo * 50` (3), `Frasco de miel` (3), `Media botella miel` (2), `Copas de miel` (2), etc.
- Solamente los consume `interpretarPedido` (L204).

### Copia D (oculta, no listada en la deuda) — `diccionarioCategorias` en `backend/src/utils/diccionario.js` (L2-17)

- **11 categorías, 23 nombres canónicos**. Es la tabla de categorización contable.
- ⚠️ **Le falta `"Ajo en polvo * 50"`** → `obtenerCategoria("Ajo en polvo * 50")` retorna `null` (verificado ejecutando el código real) → `buildOperacionesContables` hace `if (!categoria) continue` (L224) → **cada venta de Ajo en polvo se vende y factura, pero NUNCA entra a Total Productos, Cartones_vendidos ni Ganancias**. Es un bug contable REAL y demostrable en producción.

### Copia E — `normalizarTexto` (`backend/src/utils/normalizarTexto.js`, L2-14)

- No es una copia de nombres, pero **codifica conocimiento del catálogo**: reglas `clavos→clavo`, `ajies→aji`, `mieles→miel` y la regla `de→*` (L11).
- La regla `de→*` es **asimétrica**: reemplaza "de" por `*` DESPUÉS de que la limpieza de símbolos ya quitó los `*` del nombre del producto. Resultado: el nombre canónico `"Clavo * 100"` normaliza a `clavo 100`, pero la entrada de usuario `"clavo de 100"` normaliza a `clavo * 100` (con asterisco). Las claves de `equivalencias` se computan con el mismo pipeline, por lo que `"bicarbonato 50"` (clave) ≠ `"bicarbonato * 50"` (entrada con "de") — **la entrada con "de" nunca pega en el mapa exacto**.

---

## 2. Mapa de consumo

| Consumidor | Copia que usa | Dónde |
|---|---|---|
| `interpretarPedido` (inturis) | `productosOriginales` + `equivalencias` + `normalizarTexto` + Fuse | `inturis.js` L182-236 |
| `procesarMensajeTwilio` (inturis) | delega en `interpretarPedido` + axios a `/api/ventas/pedido-libre` | `inturis.js` L243-270 |
| `POST /api/ventas/pedido-libre` | `interpretarPedido` (nombre canónico) + **Firestore** (subcolección y precio) | `routes/ventas.js` L45, L64, L106, L114 |
| Webhook WhatsApp `/api/whatsapp/webhook` | `procesarMensajeTwilio` | `whatsapp/index.js` L85 |
| `GET /api/productos` | **Firestore** (getAllProductos) | `routes/productos.js` L9 |
| `obtenerCategoria` (contabilidad) | `diccionarioCategorias` + `normalizarTexto` | `repositories/contabilidad.repository.js` L38-60 |
| `buildOperacionesContables` (job contable + cierre) | `obtenerCategoria` | `contabilidad.repository.js` L205-282; `jobs/jobContableMensual.js` L92 |
| `normalizarTexto` | — (util) | consumido por inturis y contabilidad.repository |

**Frontend**: NO existe directorio `frontend/` en el repo (está declarado como workspace en `package.json` y package-lock, pero la carpeta no existe). No hay ningún consumidor frontend real hoy. El único contrato externo del catálogo es `GET /api/productos` → `[{id, subcolecciones: {<nombre>: [{id, Precio carton, Precio unidad, Peso unidad, Precio a dar tienda}]}}]`.

---

## 3. Análisis de sincronización / divergencia

### Sincronizado (hoy)
- Los **24 nombres de subcolección de Firestore == 24 strings de `productosOriginales`** (verificado 1:1 contra producción). La sincronización es manual: no existe ningún script de seed/migración ni escritura a `Productos` en todo `backend/src` (grep verificado).
- El typo `"Canela molidad * 100"` es **consistente en las 3 copias** (Firestore, productosOriginales, diccionario) — el typo está en la propia base de datos.

### Divergencias reales (verificadas ejecutando el código)
1. **`Ajo en polvo * 50` falta en `diccionarioCategorias`** → categoría `null` → el job contable **ignora** silenciosamente esas ventas (bug contable vivo en producción).
2. **Bug Fuse v7 — el fallback fuzzy está muerto**: `fuse.js` instalado es **7.1.0**; en v7 el campo `score` de los resultados solo existe con la opción `includeScore: true` (verificado contra las typings del propio paquete: `score?: number`). `interpretarPedido` NO la pasa (L168-177), por lo que `busqueda[0].score` es `undefined` y `undefined < 0.8` es siempre `false` (L216): **la rama fuzzy NUNCA acepta**. Solo las coincidencias exactas de `equivalencias` resuelven producto; todo lo demás cae a `"No identificado"` (con sugerencias). Verificado con 10 pedidos reales: `"media botella miel"` (candidato EXACTO del índice) devuelve `"No identificado"`.
3. **`reemplazarNumerosPalabras` no incluye `"un"`** (solo `uno/una`, L8-19) → `"un aji grande"` no resuelve ni por equivalencias (`aji grande` SÍ es clave) ni por Fuse → `"No identificado"` con sugerencia `"Canela * 50 grande"`. Confirmado en runtime.
4. **Asimetría `de→*` de `normalizarTexto`**: `"bicarbonato de 50"` → `bicarbonato * 50`, que no es clave de equivalencias (la clave es `bicarbonato 50`) → cae a Fuse → hoy "No identificado" (y con el fix de `includeScore` resolvería bien por fuzzy, pero con confianza baja).
5. **Docs desactualizadas**: `docs/database/modelo-datos.md` documenta los campos del producto como `peso unidad/precioVenta/precioCarton/precioUnidad`, pero la realidad son `Precio carton/Precio unidad/Peso unidad/Precio a dar tienda`. (Hallazgo adyacente, no bloqueante.)

### Fricción estructural
La dependencia fuerte es que `ventas.js` usa el **string canónico salido de inturis como nombre de subcolección** en Firestore (`buscarSubcoleccion(p.producto)` L64). Esa es la cuerda que une las copias: si un nombre cambia en un lado y no en el otro, el pedido falla con `producto_no_encontrado`/subcolección inexistente (warn en L67 y `continue`).

---

## 4. Diagrama de flujo actual

```
[WhatsApp] ──> whatsapp/index.js (webhook) ──> procesarMensajeTwilio(inturis)
                                                    │
[API] POST /api/ventas/pedido-libre <────────────────┘  (axios)
  │
  ├─▶ interpretarPedido(mensaje)  [inturis.js]
  │     ├─ reemplazarNumerosPalabras  (⚠️ sin "un")
  │     ├─ split por "," / " y "
  │     ├─ EQUIVALENCIAS (mapa exacto, hardcode L61-162) ──✅─> nombre canónico
  │     └─ FUSE index (productosOriginales hardcode, ⚠️ v7 sin includeScore → muerto)
  │              └─ "No identificado" + sugerencias
  │
  ├─▶ productosRepo.buscarSubcoleccion(nombre) ──> Productos/Productos_ID/{nombre}
  ├─▶ productosRepo.getProducto(sub, docId) ──> "Precio carton" → subtotal
  │
  ├─▶ ventasRepo.crearPedido(...)  (detalle con nombre canónico embebido)
  │
  └─ (posterior) job contable / cierre
        └─▶ buildOperacionesContables ──> obtenerCategoria(nombre)
               └─ diccionarioCategorias (hardcode, ⚠️ falta "Ajo en polvo * 50")
                      └─> Total Productos / Cartones_vendidos / Ganancias
```

**El catálogo se "construye" en 3 momentos distintos**: al cargar el módulo inturis (índice Fuse + mapa de equivalencias, sincrónico, una sola vez), en cada pedido (lookup de precio en Firestore), y en cada procesamiento contable (categorización vía diccionario).

---

## 5. Evaluación de la solución propuesta

### Propuesta del usuario
> Una única fuente de verdad (Firestore): cargar el catálogo al iniciar, construir Fuse + equivalencias desde esa data, sinónimos como datos por producto (campo o colección `equivalencias`).

### Veredicto: **viable y correcta en dirección — con 4 condiciones y 1 hallazgo cualitativo**

| Aspecto | Evaluación |
|---|---|
| Firestore como fuente única | ✅ Correcto. Ya es la fuente para precios (ventas) y listado (GET /api/productos). La sonda confirma que los 24 nombres de subcolección son el catálogo real. |
| Cargar al iniciar | ⚠️ **Riesgo de arranque**: `interpretarPedido`/`procesarMensajeTwilio` son `require`s de nivel superior (ventas.js L4, whatsapp/index.js L4) y `interpretarPedido` hoy es **síncrona** (L182). Cargar desde Firestore fuerza init async (bootstrap antes de `app.listen`) o lazy-load con caché. Decidir política ante fallo de Firestore al boot: **fail-fast** (morir con error claro) vs **fallback a snapshot** (arrancar con copia cachead. 24 productos = 24 lecturas + 24 doc reads (o listCollections), trivial en costo. |
| Índice Fuse desde Firestore | ✅ Correcto. El índice es **derivable** (no una copia más): `{nombre: subcol.id, normalizado}`. **No crear una colección `Catalogo` duplicada** — usar las subcolecciones mismas. |
| Sinónimos como datos | ✅ Correcto. Son 53, todos **específicos de producto** (ninguno global): caben como campo `sinonimos: string[]` en el doc del producto (cada subcolección tiene 1 doc). ⚠️ La clave de lookup se computa con `normalizarTexto`; si la normalización sigue siendo asimétrica (`de→*`), los sinónimos almacenados no matchearán entradas con "de". |
| Refresco | ❓ Decidir: ¿solo al boot, o listener/refresh manual? Un listener en `Productos/Productos_ID` no es directo (listCollections no es observable); opción pragmática: recargar al boot + endpoint/flag admin para recargar. |
| Migración de datos | ❓ El typo `Canela molidad * 100` está **en la DB** y embebido en pedidos históricos y SKUs contables (`sku` doc id en Total Productos). Renombrar la subcolección rompe consistencia con el histórico; opción segura: mantener el nombre canónico actual y agregar sinónimos correctos (`canela molida 100`, `canela molida grande`). |

### Hallazgos que el cambio propuesto DEBE absorber (o el refactor queda incompleto)
1. **`Ajo en polvo * 50` fuera de categorías** (bug contable vivo). Si la categoría pasa a ser dato por producto, se arregla de paso; de lo contrario hay que agregarlo a `diccionarioCategorias` hoy.
2. **Fuse v7 sin `includeScore: true` → rama fuzzy muerta**. El refactor reconstruye el índice de todas formas; incluir la opción y testear la rama con un caso fuzzy real. OJO: con Fuse solo, `"aji grande"` resuelve a `"Canela * 50 grande"` (score 0.546 < 0.8) — **el orden "equivalencias exactas primero, Fuse después" es parte del diseño actual** y debe preservarse (o bajar el threshold).
3. **`un` ausente en `numerosPalabras`**: bug independiente pero del mismo dominio (interpretación de pedidos); recomiendo corregirlo en el mismo cambio (o al menos registrarlo).
4. **Asimetría `de→*`**: al mover sinónimos a datos, normalizar ambos lados con la misma función y decidir si la regla `de→*` se elimina (recomendado: reemplazar "de" por espacio, o quitarlo, para que `"clavo de 100"` == `"clavo 100"` == nombre canónico normalizado). Cambia `normalizarTexto` y sus tests (7 casos podrían verse afectados).

### Enfoques alternativos
1. **A (propuesta del usuario, con condiciones)** — Firestore como fuente única + boot async + sinónimos por producto + fixes absorbidos. Pros: elimina la triple fuente, arregla el bug contable de Ajo en polvo, el índice pasa a ser derivado. Contras: toca arranque, normalización, Fuse y tests; decisión de migración del typo. **Esfuerzo: Medio-Alto.**
2. **B (intermedia)** — Consolidar SOLO las copias de inturis en un `catalog.json` versionado + un script de validación que compare contra Firestore en CI (manual). Pros: mínimo riesgo, rápido. Contras: sigue habiendo 2 fuentes (JSON + Firestore); no arregla el bug contable de Ajo en polvo ni Fuse muerto; el JSON se desincroniza igual. **Esfuerzo: Bajo.**
3. **C (híbrida)** — Firestore como fuente + **snapshot JSON commiteado** como fallback de boot (offline) + validación en CI de que el snapshot == Firestore. Pros: arranque resiliente, CI detecta desincronización, sin duplicar lógica (el snapshot es caché, no fuente). Contras: un archivo más que mantener (aunque regenerable con script). **Esfuerzo: Medio.**

**Recomendación**: **Enfoque A** (la dirección del usuario es la correcta), con estas decisiones explícitas en la propuesta: (i) init async del catálogo antes de `app.listen` con **fail-fast + mensaje claro** (y opcional snapshot como mejora posterior); (ii) sinónimos como campo `sinonimos` array en el doc del producto, derivando el índice Fuse de `{nombre, sinonimos[]}` normalizados con la MISMA función; (iii) absorber los 4 hallazgos (Ajo en polvo, includeScore, "un", asimetría de) en el mismo cambio o en 2 PRs encadenados; (iv) NO renombrar `Canela molidad` (decisión de datos para el usuario, ver preguntas). El bug de Ajo en polvo + Fuse muerto son tan serios que **merecen fix inmediato independiente** si el refactor completo se demora.

---

## 6. Preguntas abiertas antes de la spec

1. **Autoridad de escritura del catálogo**: ¿Firestore pasa a ser la única forma de alta/baja (consola manual), o se quiere además una ruta admin de CRUD de productos/sinónimos? (Hoy NO existe ninguna escritura a `Productos` en el backend.)
2. **Typo `Canela molidad * 100`**: ¿corregir el nombre (con migración de histórico) o mantenerlo como canónico y agregar sinónimos correctos? (Recomiendo mantener + sinónimos; el histórico contable usa el nombre como SKU.)
3. **`Ajo en polvo * 50` sin categoría**: ¿se incluye su fix en este cambio (la categoría pasa a dato) o se corrige ya en `diccionarioCategorias` por separado? (Es un bug contable vivo.)
4. **Política de boot**: ¿fail-fast si Firestore no responde al arrancar, o fallback a un snapshot cacheado? ¿Se acepta un `catalog.snapshot.json` versionado + script de regeneración/validación en CI?
5. **Refresco del índice en runtime**: ¿solo al boot, o se acepta un endpoint/accion admin de recarga (`POST /admin/recargar-catalogo`)?
6. **Fuse y normalización**: ¿se mete en este cambio el fix de `includeScore: true` + eliminación de la asimetría `de→*` + el `"un"` de `numerosPalabras`? (Recomiendo sí: tocan las mismas líneas que el refactor.)
7. **Tests**: hoy `interpretarPedido`/`equivalencias`/Fuse **no tienen ningún test directo** (el test de integración de ventas mockea inturis completo). ¿Se incluye una suite unitaria de interpretación como parte del cambio?
8. **Dependencia `fuse` (CLI v0.12.1)**: está instalada pero no se usa en ninguna parte (`package.json` de backend). ¿Eliminar en este cambio o en uno de limpieza?

---

## Ready for Proposal

**Sí.** La deuda es real y está probada con evidencia de producción: 4 copias del catálogo (Firestore, `productosOriginales`, `equivalencias`, y la oculta `diccionarioCategorias`), un bug contable vivo (`Ajo en polvo` nunca entra en los totales), la rama fuzzy de Fuse muerta por `includeScore` en v7, y dos bugs menores de interpretación (`un`, asimetría `de→*`). La solución propuesta (Firestore como única fuente, sinónimos como datos, índice Fuse derivado) es viable; recomiendo aprobarla condicionada a las decisiones de las preguntas 1-8 y absorber los hallazgos 1-4 en el mismo cambio (o en PRs encadenados). Recomendación al usuario: decidir el destino del typo `Canela molidad` y la política de boot ANTES de la spec, porque condicionan el diseño del arranque y la migración.

---

## Corrección de interpretación (2026-09-15)

**La regla `de→*` de `normalizarTexto` NO es un bug — es una regla de negocio deliberada.** El `*` es el separador canónico de los nombres de producto (`Clavo * 100`, `Miel * 50`), y el "de" del lenguaje natural se mapea a ese `*`. El hallazgo 4 ("asimetría") y la recomendación de la pregunta 6 de eliminarla fueron una **mala interpretación** del desarrollo del negocio.

**Decisión del usuario: se mantiene la regla tal cual.** Los tests originales de `normalizarTexto` están correctos y NO se modifican. El alcance del cambio `catalog-single-source` NO incluye tocar `normalizarTexto` — fue removido de proposal/spec/design/tasks.

**Implicancia para futuras sesiones:** si la normalización deja de coincidir con claves de `equivalencias` para entradas con "de", eso es comportamiento de negocio conocido y aceptado (el path fuzzy de Fuse ya cubre esas entradas). No reintroducir el fix de "de" sin una decisión explícita del negocio.