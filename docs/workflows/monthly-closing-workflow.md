## Flujo de trabajo para cierre mensual

### Resumen

Este flujo describe el proceso de cierre mensual financiero del sistema.

El objetivo es consolidar resultados operativos y calcular ganancias finales utilizando históricos mensuales acumulados.

---

### Objetivo

Generar consolidación financiera mensual por categoría utilizando:

- Ventas históricas
- Cartones vendidos
- Costos operativos
- Gastos variables y fijos

---

### Flujo de trabajo

```text
Administrator
   ↓
Admin Route
   ↓
Permission Validation
   ↓
ganancias.service.js
   ↓
Financial Calculations
   ↓
Firestore Persistence
```

---

### Fjulo detallado

### 1. El administrador inicia el proceso

El administrador ejecuta manualmente el cierre mensual.

---

### 2. Ejecución de la ruta

El sistema ejecuta:

```text
admin.contabilidad.routes.js
```

---

### 3. Validación de permisos

La ruta valida:

- Permisos administrativos
- Autorización de ejecución
- Acceso seguro

---

### 4. Ejecución de servicios de rentabilidad

La ruta ejecuta:

```text
ganancias.service.js
```

Responsable de:

- Consolidación financiera
- Cálculo de ganancias
- Procesamiento mensual

---

### 5. Historical Data Consumption

El service utiliza históricos previamente generados desde:

### Historico mensual

```text
Historico_Mensual/{mesAnio}
```

---

### 6. Cálculo de costos

El sistema descuenta costos provenientes de:

```text
Invertir/{Categoria}
```

Incluyendo:

- Costos fijos
- Costos variables
- Costos por categoría

---

### 7. Cálculos contables

El sistema calcula:

- Ingresos totales
- Costos totales
- Ganancias netas
- Resultados por categoría

---

### 8. Persistencia en Firestore

El resultado final se almacena en:

```text
Ganancias/{mesAnio}
```

---

### Diseño financiero

El diseño actual busca mantener:

- Separación histórica
- Trazabilidad mensual
- Consolidación financiera progresiva

---

### Limitaciones actuales

Actualmente el sistema aún no implementa completamente:

- Transacciones financieras atómicas
- Rollback automático
- Protección avanzada contra doble cierre mensual

---

### Mejoras previstas

### Procesamiento financiero atómico

Garantizar consistencia financiera mediante transacciones.

---

### Sistema de bloqueo mensual

Evitar múltiples cierres del mismo período.

---

### Cierres mensuales idempotentes

Proteger contra ejecución duplicada.

---

### Registro de auditoría

Registrar:

- Quién ejecutó el cierre
- Cuándo fue ejecutado
- Cambios realizados

---

### Resúmenes financieros

Generar snapshots históricos inmutables.

---

### Consideraciones de seguridad

- Acceso exclusivo administrador
- Procesamiento backend-only
- Protección de cálculos financieros
- Validaciones internas estrictas