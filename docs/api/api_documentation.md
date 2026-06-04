## API Documentación

### Resumen

Esta documentación describe los endpoints principales del sistema Inventory Management System.

La API está construida con:

- Node.js
- Express.js
- Firebase Firestore

---

### API de Productos

### Ruta base

```text
/api/productos
```

---

### GET `/api/productos`

Obtiene la lista completa de productos registrados.

### Solicitud (Request)

```http
GET /api/productos
```

---

### Respuesta (Response)

```json
[
  {
    "id": "String",
    "nombre": "String",
    "precio": "Number",
    "stock": "Number"
  }
]
```

---

### Posibles errores

| Status | Description |
|---|---|
| 500 | Internal server error |

---

### Validaciones

- Verificación de conexión con Firestore
- Validación de estructura de datos obtenidos

---

### API de Ventas

### Ruta base

```text
/api/ventas
```

---

### GET `/api/ventas`

Obtiene historial de ventas.

### Solicitud (Request)

```http
GET /api/ventas
```

---

### Respuesta (Response)

```json
[
  {
    "id": "String",
    "total": "Number",
    "fecha": "Timestamp"
  }
]
```

---

### Posibles errores

| Status | Description |
|---|---|
| 500 | Internal server error |

---

### Validaciones

- Verificación de conexión con base de datos

---

### POST `/api/ventas`

Registra una nueva venta.

### Solicitud (Request)

```http
POST /api/ventas
```

### Body

```json
{
  "productos": [
    {
      "id": "String",
      "cantidad": "Number"
    }
  ],
  "Pagado": "Boolean"
}
```

---

### Respuesta (Response)

```json
{
  "message": "Venta registrada correctamente"
}
```

---

### Posibles errores

| Status | Description |
|---|---|
| 400 | Datos inválidos |
| 404 | Producto no encontrado |
| 500 | Internal server error |

---

### Validaciones

- Productos requeridos
- Cantidades válidas
- Stock suficiente
- Método de pago válido

---

### API de WhatsApp

### Ruta Base 

```text
/api/whatsapp
```

---

### POST `/api/whatsapp/webhook`

Endpoint destinado al procesamiento de mensajes y pedidos provenientes de WhatsApp.

### Solicitud (Request)

```http
POST /api/whatsapp/webhook
```

### Body

```json
{
  "from": "573001112233",
  "message": "Quiero 2 productos"
}
```

---

### Respuesta (Response)

```json
{
  "message": "Mensaje procesado correctamente"
}
```

---

### Posibles errores

| Status | Description |
|---|---|
| 400 | Datos inválidos |
| 500 | Internal server error |

---

### Validaciones

- Formato de mensaje
- Validación de remitente
- Estructura del payload

---

### API de Administrador

### Ruta Base

```text
/api/admin
```

### GET `/api/admin`

Obtiene reportes operativos y financieros.

### Solicitud (Request)

```http
GET /api/admin
```

---

### Respuesta (Response)

```json
{
  "ventas": [],
  "inventario": [],
  "ganancias": []
}
```

---

### Posibles errores

| Status | Description |
|---|---|
| 401 | No autorizado |
| 500 | Internal server error |

---

### Validaciones

- Acceso restringido a administradores

---

### API del botón de administración

### Ruta base

```text
/api/admin/buttons
```

---

### POST `/api/admin/buttons`

Procesa acciones administrativas disparadas desde botones operativos del sistema.

### Solicitud (Request)

```http
POST /api/admin/buttons/action
```

### Body

```json
{
  "action": "cierre_mensual"
}
```

---

### Respuesta (Response)

```json
{
  "message": "Acción ejecutada correctamente"
}
```

---

### Posibles errores

| Status | Description |
|---|---|
| 400 | Datos inválidos |
| 401 | No autorizado |
| 500 | Internal server error |

---

### Validaciones

- Acción requerida
- Acción permitida
- Validación de permisos

---

## Formato de errores

La API utiliza una estructura estándar para errores.

### Ejemplo

```json
{
  "error": true,
  "message": "Invalid request data"
}
```

---

## Autenticación

Actualmente el sistema se encuentra en proceso de evolución hacia un modelo de autenticación más robusto.

### Mejoras previstas

- Autenticación JWT
- Acceso basado en roles
- Validación de sesiones
- Puntos de acceso de administración seguros

---

## Testing

Los endpoints críticos cuentan con testing automatizado enfocado en:

- Reglas de negocio
- Procesamiento contable
- Validaciones operativas
- Integridad de inventario

---

## Estado actual

La API continúa evolucionando en:

- Validaciones
- Seguridad
- Consistencia transaccional
- Idempotencia
- Escalabilidad
- Automatización