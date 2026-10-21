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

Todas las rutas de administración exigen autenticación. Hay dos mecanismos y
cada endpoint usa el que corresponde a su tipo de cliente:

| Mecanismo | Header | Fuente del secreto |
|---|---|---|
| `requireAdminToken` | `Authorization: Bearer <token>` | variable de entorno `ADMIN_TOKEN` |
| `adminAuth` | `Authorization: Bearer <firebase id token>` | token de Firebase + verificación del rol en la colección de administradores |

---

### POST `/api/admin/job-contable`

Ejecuta el job contable mensual.

### Solicitud (Request)

```http
POST /api/admin/job-contable
Authorization: Bearer <ADMIN_TOKEN>
```

### Respuesta (Response)

```json
{
  "ok": true,
  "mensaje": "Job contable ejecutado correctamente"
}
```

### Posibles errores

| Status | Description |
|---|---|
| 401 | Header ausente, token incorrecto o `ADMIN_TOKEN` no configurado |
| 500 | Error ejecutando el job |

---

### POST `/api/admin/recargar-catalogo`

Recarga el catálogo desde Firestore en runtime.

### Solicitud (Request)

```http
POST /api/admin/recargar-catalogo
Authorization: Bearer <ADMIN_TOKEN>
```

### Respuesta (Response)

```json
{
  "success": true,
  "productos": 24
}
```

### Posibles errores

| Status | Description |
|---|---|
| 401 | Header ausente, token incorrecto o `ADMIN_TOKEN` no configurado |
| 500 | Error recargando el catálogo (el catálogo anterior sigue activo) |

---

### POST `/api/admin/cerrar-mes`

Cierra la contabilidad del mes indicado.

### Solicitud (Request)

```http
POST /api/admin/cerrar-mes
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Body

```json
{
  "mesAnio": "Febrero de 2026"
}
```

### Posibles errores

| Status | Description |
|---|---|
| 401 | Token no proporcionado o inválido |
| 403 | El usuario autenticado no es administrador |
| 400 | `mesAnio` ausente |

---

### POST `/admin/cerrar-categoria`

Cierra la contabilidad de una categoría.

> Ruta base `/admin` (no `/api/admin`).

### Solicitud (Request)

```http
POST /admin/cerrar-categoria
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Body

```json
{
  "mesAnio": "Junio 2026",
  "categoria": "Salsas"
}
```

El nombre del administrador que queda en la auditoría se toma del token
verificado, no del body: el cliente no puede escribir el nombre que se
registra.

### Posibles errores

| Status | Description |
|---|---|
| 401 | Token no proporcionado o inválido |
| 403 | El usuario autenticado no es administrador |
| 400 | `mesAnio` o `categoria` ausentes |

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

Cada ruta valida al cliente según el tipo de llamada que espera.

### Mecanismos

| Mecanismo | Rutas | Credencial |
|---|---|---|
| Firma de Twilio | `POST /api/whatsapp/webhook` | `X-Twilio-Signature` + `TWILIO_AUTH_TOKEN` |
| Allowlist de remitente | `POST /api/whatsapp/webhook` | el `From` debe ser uno de los administradores autorizados |
| Token interno | `POST /api/ventas/pedido-libre` | header `x-internal-token` |
| Token de administrador | `POST /api/admin/job-contable`, `POST /api/admin/recargar-catalogo` | `Authorization: Bearer <ADMIN_TOKEN>` |
| Token de Firebase + rol | `POST /api/admin/cerrar-mes`, `POST /admin/cerrar-categoria` | `Authorization: Bearer <firebase id token>` |

Todos fallan cerrados: si la variable de entorno o la credencial no está
configurada, la ruta rechaza la llamada en lugar de dejarla abierta.

### CORS

Las peticiones de browser están limitadas a los orígenes de
`CORS_ALLOWED_ORIGINS` (lista separada por comas). Un origen fuera de la
lista recibe `403 origin_not_allowed` y la petición no llega al handler.

Sin `CORS_ALLOWED_ORIGINS` configurado ningún origen de browser pasa: hay que
declarar los orígenes del frontend. Las peticiones servidor a servidor
(Twilio, curl, cron) no mandan la cabecera `Origin` y no se ven afectadas.

### Rate limiting

`POST /api/whatsapp/webhook` y `POST /api/ventas/pedido-libre` tienen un
límite por ventana (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`). Al superarlo
responden `429 too_many_requests`.

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