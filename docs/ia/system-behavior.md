## Comportamiento del Sistema

## Resumen

Este documento define cómo debe comportarse el sistema a nivel operativo y arquitectónico.

---

## Flujo Principal

El sistema funciona principalmente mediante:

```text
Pedido WhatsApp
   ↓
Procesamiento NLP
   ↓
Registro de venta
   ↓
Procesamiento contable
   ↓
Históricos mensuales
   ↓
Cierre financiero
```

---

## Comportamiento de Pedidos

## Los pedidos ingresan vía WhatsApp

El sistema recibe mensajes mediante:

- Twilio Webhooks

---

## Los pedidos son interpretados mediante NLP

Responsable:

```text
inturis.js
```

---

## El NLP debe generar datos estructurados

El sistema nunca debe persistir lenguaje natural directamente.

---

## Pedidos inválidos no deben registrarse

Si el NLP falla:

- No persistir pedido
- No actualizar inventario
- No ejecutar cálculos

---

## Comportamiento Contable

## El procesamiento contable es automático

Responsable:

```text
JobContableMensual.js
```

---

## Todos los cálculos son backend-only

Incluyendo:

- Ganancias
- Acumulados
- Históricos
- Consolidaciones

---

## El sistema actualiza históricos mensuales

Colecciones afectadas:

```text
Total Productos
Cartones_vendidos
Ganancias
Historico_Mensual
```

---

## Comportamiento Histórico

## Toda información financiera es histórica

El sistema debe mantener:

- Trazabilidad
- Segmentación mensual
- Persistencia acumulativa

---

## Comportamiento de Seguridad

## Operaciones críticas requieren permisos

Incluyendo:

- Cierre mensual
- Administración
- Consolidaciones

---

## Las credenciales nunca deben hardcodearse

Todo debe manejarse mediante:

```text
.env
```

---

## Comportamiento Esperado de la IA

## La IA debe respetar la arquitectura existente

La IA no debe:

- Mover lógica crítica al frontend
- Romper separación de responsabilidades
- Duplicar lógica innecesariamente

---

## La IA debe priorizar mantenibilidad

Toda sugerencia debe considerar:

- Escalabilidad
- Desacoplamiento
- Testing
- Claridad

---

## Comportamiento Esperado del Código

## El sistema debe ser testeable

Toda lógica crítica debe poder validarse mediante tests.

---

## El sistema debe evolucionar hacia atomicidad

Actualmente aún existen limitaciones relacionadas con:

- Concurrencia
- Transacciones
- Rollback

Las nuevas implementaciones deben prepararse para solucionar estas limitaciones.

---

## Comportamiento Futuro Esperado

El sistema evolucionará hacia:

- Procesamiento idempotente
- Jobs distribuidos
- Transacciones Firestore
- Autenticación robusta
- CI/CD automatizado
- Frontend React completo
- Dashboard administrativo
- Integración IA avanzada