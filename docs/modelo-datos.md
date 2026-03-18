#  Modelo de Datos
Condimentos El Colibrí - Inventory Management System

---

## 1. Enfoque

El sistema utiliza Firebase Firestore como base de datos NoSQL basada en documentos.

El modelo está diseñado bajo principios de:

- Simplicidad
- Escalabilidad
- Lecturas eficientes
- Denormalización controlada

No se utiliza un modelo relacional tradicional.
Las relaciones se manejan mediante referencias por ID.

---

## 2. Colecciones Principales

### productos

Ruta:
Productos/{Productos_ID}

Estructura:

{
  Nombre_producto/NombreID: [
    { 
        peso unidad: string,
        precioVenta: number,
        precioCarton: number,
        precioUnidad: number
    }
  ] 
}

---

### ventas

Ruta:
Ventas/{clienteId}

{
  Pedidos/MesAnio/pedidos/Pedido_IdX: [
    {
      clienteId: string,
      clienteNombre: string,
      contabilidadAplicada: boolean,
      creadoEn: timestamp,
      creadoPor: string,
      descripcion: string,
      detalle: array,
      estadoContable: "pendiente" | "procesado",
      fechaPedido: timestamp,
      fechaProcesado: timestamp,
      mensajeOriginal: string,
      numeroPedido: number,
      pedidoId: string,
      subtotal: number,
      tipoPedido: string
    }
  ],
  actualizadoEn: timestamp,
  clienteId: string,
  clienteNombre: stirng
}

Nota:
Se almacenan datos duplicados del producto (nombre, Id, precio)
para evitar lecturas adicionales al momento de consultar ventas históricas.

---


### usuarios

Ruta:
Usuarios/{UsuarioId}

{
  activo: boolean,
  email: string,
  fechaCreacion: timestamp,  
  nombre: string,
  rol: "admin" | "operador",
}

---

## 3. Relaciones

Relaciones lógicas:

- ventas.productos[].productoId → productos
- pedidos.productos[].productoId → productos
- ventas.registradoPor → usuarios

No existen claves foráneas.
Las relaciones se manejan por referencia de ID.

---

## 4. Estrategia de Consultas

El modelo está optimizado para:

- Consultar ventas por fecha
- Consultar stock actual rápidamente
- Consultar pedidos pendientes
- Generar reportes contables

Se evita el uso de joins debido al modelo NoSQL.

---

## 5. Escalabilidad

El diseño permite:

- Agregar subcolecciones si el volumen crece
- Implementar agregaciones pre-calculadas
- Crear índices compuestos en Firestore
- Implementar reportes históricos sin afectar rendimiento


## 6. Diagrama del modelo de datos

![Modelo de datos](./images/Modelo%20de%20datos.png)