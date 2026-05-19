## Esquema de la base de datos

### Resumen

Este documento describe la estructura actual de base de datos utilizada en Inventory Management System.

La base de datos está construida sobre:

- Firebase Firestore

El diseño actual está orientado a:

- Organización jerárquica
- Separación operativa
- Facilidad de consultas históricas

---

### Colecciones de Firestore

---

### Colección de Ventas

### Path

```text
Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}
```

---

### Objetivo

Almacenar pedidos y ventas realizadas por clientes organizadas por mes y año.

---

### Estructura

### Documento del cliente

```text
Ventas/{clienteId}
```

| Field | Type |
|---|---|
| clienteId | String |
| nombre | String |
| actualizadoEn | Timestamp |

---

### Documento de pedidos mensuales

```text
Pedidos/{mesAnio}
```

| Field | Type |
|---|---|
| totalPedidos | Number |
| actualizadoEn | Timestamp |

---

### Pedido Document

```text
pedidos/{pedidoId}
```

| Field | Type |
|---|---|
| clienteId | String |
| clienteNombre | String |
| contabilidadAplicada | Boolean |
| creadoEn | Timestamp |
| descripcion | String |
| detalle | Array |
| estadoContable | String |
| fechaPedido | Timestamp |
| fechaProcesado | Timestamp |
| mensajeOriginal | String |
| numeroPedido | Number |
| pedidoId | String |
| subTotal | Number |
| tipoPedido | String |

---

### Colección Total Productos 

### Path

```text
Total Productos/{mesAnio}/productos/{categoria}/skus/{sku}
```

---

### Objetivo

Registrar inventario total de productos organizados por período mensual, categoría y SKU.

---

### Estructura

### Documento de inventario mensual

```text
Total Productos/{mesAnio}
```

| Field | Type |
|---|---|
| actualizadoEn | Timestamp |
| creadoEn | Timestamp |
| estado | String |
| mesAnio | String |
| totalGeneral | Number |

---

### Documento sobre la categoría del producto

```text
productos/{categoria}
```

| Field | Type |
|---|---|
| total | Number |

---

### Documento SKU

```text
skus/{sku}
```

| Field | Type |
|---|---|
| sku | String |
| total | Number |


---

### Colección de Cartones Vendidos 

### Path

```text
Cartones_vendidos/{mesAnio}/productos/{categoria}/skus/{sku}
```

---

### Objetivo

Registrar productos vendidos y movimientos históricos organizados por período y categoría.

---

### Estructura

### Documento de ventas mensualas

```text
Cartones_vendidos/{mesAnio}
```

| Field | Type |
|---|---|
| actualizadoEn | Timestamp |
| creadoEn | Timestamp |
| estado | String |
| mesAnio | String |
| totalGeneral | Number |

---

### Documento sobre la categoría del producto

```text
productos/{categoria}
```

| Field | Type |
|---|---|
| total | Number |

---

### Documento SKU

```text
skus/{sku}
```

| Field | Type |
|---|---|
| sku | String |
| total | Number |


---

### Colección de Ganancias

### Path

```text
Ganancias/{mesAnio}
```

---

### Objetivo

Almacenar consolidación financiera y ganancias mensuales.

---

### Estructura

### Documento de ganancias mensuales

```text
Ganancias/{mesAnio}
```

| Field | Type |
|---|---|
| cartones | Number |
| categoria | String |
| estado | String |
| fechaCierre | Timestamp |
| gananciaNeta | Number |
| inversionTotal | Number |
| inversionUnit | Number |
| mesAnio | String |
| ventaTotal | Number |

---

### Relaciones

La base de datos utiliza relaciones jerárquicas basadas en:

- Cliente
- Período mensual
- Categoría
- SKU

---

### Resumen de las relaciones

```text
Cliente
   ↓
Ventas
   ↓
Pedidos


Ventas
   ↓
Total Productos
   ↓
Categoría
   ↓
SKU



Ventas
   ↓
Cartones_vendidos
   ↓
Categoría
   ↓
SKU



Total Porductos / Cartones_vendidos
   ↓
Ganancias
   ↓
Mes / Año
   ↓
Categoría
   ↓
SKU
```

---

### Relaciones lógicas

### Ventas ↔ Inventario

Las ventas afectan directamente:

```text
Total Productos
```

mediante a suma de totales vendidos.

---

### Ventas ↔ Ganancias

Cada pedido procesado impacta:

```text
Ganancias/{mesAnio}
```

mediante actualización financiera por medio de Total Productos.

---

### Ventas ↔ Cartones Vendidos

Los productos vendidos generan registros históricos en:

```text
Cartones_vendidos
```

---

### Indexación de Firestore

Actualmente el sistema utiliza principalmente índices automáticos de Firestore.

---

### Indices compuestos previstos

Se proyecta implementar índices compuestos para optimizar consultas por:

- Fecha
- Estado
- Cliente
- Categoría
- SKU

---

### Posibles consultas de optimización

### Ventas por fecha

```text
fecha + estado
```

### Productos por categoría

```text
categoria + stock
```

### Pedidos procesados

```text
procesado + createdAt
```

---

### Reglas en Firestore

Actualmente las reglas de seguridad están en proceso de fortalecimiento.

---

### Objetivos actuales

- Restringir acceso administrativo
- Proteger operaciones críticas
- Evitar escritura no autorizada
- Validar estructura básica de documentos

---

### Mejoras previstas

### Acceso basado en roles

Implementar permisos diferenciados:

- Administrador
- Operador

---

### Reglas de validación

Restringir:

- Tipos inválidos
- Estructuras incompletas
- Escrituras inconsistentes

---

### Operaciones de escritura seguras

Limitar modificaciones directas sobre:

- Ganancias
- Inventario
- Procesamiento contable

---

### Validación de datos

El backend actualmente centraliza gran parte de las validaciones operativas.

---

### Validaciones actuales

### Ventas

- Pedidos válidos
- Productos existentes
- Cantidades permitidas
- Stock suficiente

---

### Inventario

- Stock no negativo
- SKU válido
- Categorías válidas

---

### Ganancias

- Cálculos numéricos válidos
- Consolidación mensual correcta

---

### Consideraciones sobre la escalabilidad

La estructura actual fue diseñada para facilitar:

- Separación temporal
- Consultas históricas
- Modularidad documental

Sin embargo, futuras refactorizaciones serán necesarias para soportar mayor volumen operativo.

---

### Mejoras previstas

### Operaciones atómicas

Migrar operaciones críticas hacia transacciones de Firestore.

---

### Idempotencia

Evitar procesamiento duplicado de pedidos y eventos.

---

### Optimizaciones desnormalizadas

Evaluar estructuras desnormalizadas para mejorar performance de lectura.

---

### Optimización de consultas

Optimizar:

- Lecturas frecuentes
- Agregaciones
- Consultas históricas

---

### Estado actual

La arquitectura de base de datos continúa evolucionando hacia un modelo más robusto enfocado en:

- Consistencia
- Seguridad
- Escalabilidad
- Automatización
- Integridad transaccional