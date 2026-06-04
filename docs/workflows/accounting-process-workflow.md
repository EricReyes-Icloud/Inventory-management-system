## Flujo de trabajo para el proceso contable

### Resumen

Este flujo describe el procesamiento contable automático del sistema.

El objetivo es consolidar ventas, calcular movimientos operativos y actualizar históricos mensuales automáticamente.

---

### Objetivo

Automatizar el procesamiento contable mediante jobs programados ejecutados únicamente desde backend.

---

### Flujo de trabajo

```text
Cron Job
   ↓
contabilidad.service.js
   ↓
Firestore Increment Operations
   ↓
Execution Validations
   ↓
Historical Collections Update
```

---

### Flujo detallado

### 1. Ejecución de tareas programadas

Un job automático ejecuta periódicamente el proceso contable.

### Estado actual

La frecuencia de ejecución aún no ha sido definida.

---

### 2. Prestación de servicios de contabilidad

El job llama:

```text
contabilidad.service.js
```

Responsable de:

- Cálculos contables
- Consolidación operativa
- Procesamiento financiero
- Actualización lógica de resultados

---

### 3. Procesamiento solo en el backend

Todos los cálculos se realizan exclusivamente desde backend.

### Objetivo

Evitar:

- Manipulación desde frontend
- Inconsistencias
- Cálculos inseguros

---

### 4. Operaciones de incremento en Firestore

El sistema utiliza:

```text
Firestore Increment
```

para actualizar acumulados de manera eficiente.

---

### 5. Cálculos realizados

El service calcula:

- Total vendido por categoría
- Total vendido por SKU
- Cantidad de cartones vendidos
- Acumulados mensuales

---

### 6. Validaciones de ejecución

El Job realiza validaciones posteriores al procesamiento.

### Validaciones actuales

- Ejecución correcta
- Datos válidos
- Estructura esperada
- Procesamiento exitoso

---

### 7. Actualización histórica

El resultado es almacenado en:

### Total vendido

```text
Total Productos/{mesAnio}
```

### Cartones vendidos

```text
Cartones_vendidos/{mesAnio}
```

### Historico mensual

```text
Historico_Mensual/{mesAnio}
```

---

### 8. Persistencia histórica mensual

Los históricos continúan actualizándose automáticamente hasta finalizar el mes correspondiente.

---

### Diseño histórico

La arquitectura histórica permite:

- Consultas mensuales
- Consolidación progresiva
- Análisis financiero
- Trazabilidad operativa

---

### Limitaciones actuales

Actualmente el sistema aún no implementa:

- Transacciones completas
- Procesamiento idempotente
- Protección total contra concurrencia

---

### Mejoras previstas

### Jobs idempotentes

Evitar doble procesamiento de ventas.

---

### Transacciones de Firestore

Migrar operaciones críticas hacia transacciones atómicas.

---

### Bloqueo distribuido

Evitar ejecuciones simultáneas del job.

---

### Procesamiento basado en colas

Separar procesamiento pesado mediante colas asincrónicas.

---

### Recuperación mediante reintentos

Agregar recuperación automática ante fallos parciales.

---

### Consideraciones de seguridad

- Procesamiento backend-only
- Validaciones internas
- Protección de lógica contable
- Acceso restringido administrativo