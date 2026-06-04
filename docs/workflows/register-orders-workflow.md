## Flujo de trabajo para registro de pedidos

### Resumen

Este flujo describe cómo el sistema procesa pedidos recibidos desde WhatsApp utilizando Twilio y procesamiento NLP.

El objetivo principal es automatizar el registro de pedidos realizados en lenguaje natural.

---

### Objetivo

Permitir que clientes realicen pedidos vía WhatsApp y que el sistema:

- Interprete el mensaje automáticamente
- Identifique productos y cantidades
- Registre el pedido en la base de datos
- Asocie el pedido al cliente correspondiente

---

### Flujo de trabajo (Workflow)

```text
Cliente
   ↓
WhatsApp Message
   ↓
Twilio Webhook
   ↓
Inturis.js (NLP Processing)
   ↓
Ventas.js
   ↓
Firestore Database
```

---

### Flujo detallado

### 1. El cliente envía un mensaje

El cliente envía un mensaje vía WhatsApp utilizando lenguaje natural.

### Example

```text
Hola, necesito 2 canelas de 50 por favor.
```

---

### 2. Twilio recibe un mensaje

Twilio recibe el mensaje y ejecuta el webhook configurado dentro del backend.

---

### 3. Interpretación NLP (`Inturis.js`)

El mensaje es procesado por:

```text
Inturis.js
```

Responsable de:

- Interpretar lenguaje natural
- Detectar intención
- Identificar productos
- Identificar cantidades
- Estructurar datos procesables

---

### 4. Generación estructurada de pedidos

El NLP transforma el mensaje en una estructura entendible para el sistema.

### Example

```json
{
  "cliente": "clienteId",
  "productos": [
    {
      "sku": "String",
      "cantidad": "Number"
    }
  ]
}
```

---

### 5. Registro de pedidos (`Ventas.js`)

El resultado es enviado a:

```text
Ventas.js
```

Responsable de:

- Validar productos
- Validar cantidades
- Asociar pedido al cliente
- Almacenar pedido en Firestore

---

### 6. Persistencia en Firestore

El pedido se almacena en:

```text
Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}
```

---

### Validaciones actuales

### Validaciones NLP 

- Estructura básica del mensaje
- Detección de productos válidos
- Detección de cantidades

---

### Validaciones de ventas

- Cliente existente
- Productos válidos
- Stock suficiente
- Formato correcto de pedido

---

### Mejoras futuras

### Procesamiento idempotente

Evitar registros duplicados causados por reintentos de webhook.

---

### Puntuación de confianza

Agregar nivel de confianza NLP antes de registrar pedidos automáticamente.

---

### Gestión de reintentos

Implementar reintentos seguros para fallos temporales.

---

### Procesamiento basado en colas

Migrar procesamiento hacia colas para mejorar escalabilidad.

---

### Consideraciones de seguridad

- Validación de origen Twilio
- Sanitización de mensajes
- Protección de endpoints webhook
- Validación backend-only