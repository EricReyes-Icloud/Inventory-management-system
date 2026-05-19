## Reglas de negocio

## Resumen

Este documento define las reglas de negocio principales de Inventory Management System.

Las reglas aquí documentadas representan el comportamiento esperado del sistema a nivel operativo, contable y funcional.

El objetivo es garantizar:

- Consistencia de negocio
- Integridad operativa
- Trazabilidad
- Automatización segura
- Validaciones centralizadas

---

## Normas del ámbito comercial

## Regla: Cada pedido debe corresponder a un cliente

## Descripción

Todo pedido registrado debe estar asociado a un cliente válido dentro del sistema.

---

## Aplicable a

```text
Ventas/{clienteId}
```

---

## Validaciones

- `clienteId` obligatorio
- cliente existente
- cliente válido

---

## Regla: Los pedidos no pueden estar vacíos

## Descripción

Un pedido debe contener al menos un producto válido.

---

## Validaciones

- Array de productos requerido
- Mínimo un producto
- Productos válidos

---

## Regla: Las cantidades de los productos deben ser positivas

## Descripción

Las cantidades vendidas no pueden ser negativas ni iguales a cero.

---

## Validaciones

- cantidad > 0

---

## Regla: Las existencias deben ser suficientes

## Descripción

No se puede registrar una venta si el inventario disponible es insuficiente.

---

## Validaciones

- Stock disponible
- SKU existente
- Categoría válida

---

## Regla: los pedidos deben registrarse a través del backend

## Descripción

Toda lógica de registro de pedidos debe ejecutarse exclusivamente desde backend.

---

## Objetivo

Evitar:

- Manipulación desde frontend
- Cálculos inseguros
- Inconsistencias operativas

---

## Regla: La interpretación del NLP debe generar datos estructurados

## Descripción

Los pedidos interpretados desde lenguaje natural deben convertirse a una estructura válida antes de persistirse.

---

## Estructura requerida

```json
{
  "cliente": "string",
  "productos": []
}
```

---

## Regla: Las interpretaciones NLP no válidas no deben conservarse

## Descripción

Si el sistema NLP no logra interpretar correctamente un mensaje, el pedido no debe registrarse automáticamente.

---

## Objetivo

Evitar:

- Registros incorrectos
- Productos inválidos
- Cantidades ambiguas

---

## Normas de inventario

## Regla: El inventario no puede ser negativo

## Descripción

El stock de productos nunca puede ser menor a cero.

---

## Validaciones

- stock >= 0

---

## Regla: Cada SKU debe pertenecer a una categoría

## Descripción

Cada SKU debe estar asociado a una categoría válida.

---

## Objetivo

Mantener organización y trazabilidad del inventario.

---

## Regla: El SKU debe ser único

## Description

Cada producto debe poseer un SKU único dentro de su categoría.

---

## Regla: Las actualizaciones de inventario deben centralizarse

## Descripción

Las actualizaciones de inventario deben realizarse únicamente desde services backend.

---

## Objetivo

Evitar:

- Modificaciones inconsistentes
- Duplicidad lógica
- Conflictos de actualización

---

## Regla: El inventario histórico debe realizarse mensualmente

## Descripción

Los históricos operativos deben almacenarse segmentados por mes y año.

---

## Aplicable a

```text
Total Productos/{mesAnio}
Cartones_vendidos/{mesAnio}
Ganancias/{mesAnio}
```

---

## Normas del ámbito contable


## Regla: El procesamiento contable debe estar automatizado

## Descripción

El procesamiento contable debe ejecutarse mediante jobs automáticos.

---

## Objetivo

Garantizar:

- Automatización
- Consistencia
- Actualización periódica

---

## Regla: Todos los cálculos financieros deben realizarse en el servidor

## Descripción

Los cálculos financieros nunca deben ejecutarse desde frontend.

---

## Incluye

- Ganancias
- Acumulados
- Consolidaciones
- Cálculos históricos

---

## Regla: La contabilidad debe utilizar datos mensuales históricos

## Descripción

El cálculo financiero debe utilizar históricos mensuales previamente consolidados.

---

## Fuentes de datos

```text
Total Productos
Cartones_vendidos
Invertir
```

---

## Regla: Las Ganancias mensuales deben incluir los costes

## Descripción

Las ganancias mensuales deben descontar costos fijos y variables.

---

## Incluye

- costos operativos
- costos por categoría
- costos variables
- costos fijos

---

## Regla: El cierre mensual debe ser de carácter administrativo

## Descripción

El cierre financiero mensual solo puede ser ejecutado por administradores.

---

## Regla: El cierre mensual genera resultados consolidados

## Descripción

El cierre mensual debe generar resultados consolidados por categoría.

---

## Regla: Los registros financieros históricos deben conservarse

## Descripción

Los resultados financieros mensuales deben mantenerse almacenados históricamente.

## Incluye

```text
Historico_Mensual/{mesAnio}
```

---

## Normas de automatización

## Regla: Las tareas programadas deben validar su ejecución

## Descripción

Todo job automático debe validar que el procesamiento fue ejecutado correctamente.

---

## Validaciones

- Estructura válida
- Datos válidos
- Ejecución exitosa

---

## Regla: Se debe evitar el procesamiento duplicado

## Descripción

El sistema debe evolucionar hacia prevención de procesamiento duplicado.

---

## Objetivo futuro

Implementar:

- Idempotencia
- Locks
- Control transaccional

---

## Regla: Los procesos fallidos no deben corromper los datos

## Descripción

Errores parciales no deben dejar información inconsistente.

---

## Mejoras previstas

- Transacciones
- Rollback
- Recuperación automática

---

## Reglas de seguridad

---

## Regla: Las operaciones delicadas requieren autorización

## Descripción

Las operaciones críticas requieren validación de permisos.

---

## Incluye

- Cierre mensual
- Procesamiento contable
- Modificaciones administrativas

---

## Regla: Las credenciales nunca deben estar codificadas de forma fija

## Descripción

Las credenciales deben manejarse mediante variables de entorno.

---

## Regla: La lógica crítica es competencia del backend

## Descripción

La lógica crítica pertenece exclusivamente al backend.

---

## Incluye

- Cálculos
- Validaciones
- Consolidaciones
- Actualizaciones históricas

---

## Regla: El acceso a Firestore debe estar controlado

## Descripción

El acceso directo a Firestore debe mantenerse desacoplado y centralizado.

---

## Normas de Testing

## Regla: La lógica empresarial crítica debe someterse a pruebas

## Descripción

Las reglas críticas del negocio deben contar con testing automatizado.

---

## Incluye

- Procesamiento contable
- Validaciones de pedidos
- Reglas de inventario
- Consolidaciones financieras

---

## Regla: Hay que evitar retrocesos

## Descripción

El testing debe proteger el sistema contra regresiones funcionales.

---

## Reglas de Escalabilidad

## Regla: la lógica de negocio debe seguir siendo modular

## Descripción

La lógica de negocio debe mantenerse desacoplada y modular.

---

# Objetivo

Facilitar:

- Testing
- Mantenibilidad
- Escalabilidad
- Refactorización

---

## Regla: Las operaciones de Firestore deben tender hacia la atomicidad

## Descripción

Las operaciones críticas deben evolucionar hacia procesamiento atómico.

---

## Mejoras previstas

- Transacciones de Firestore
- Actualizaciones atómicas
- Garantías de consistencia

---

## Regla: El sistema debe evolucionar hacia la idempotencia

## Descripción

El sistema debe prevenir operaciones duplicadas causadas por:

- Reintentos
- Concurrencia
- Fallos parciales

---

## Regla: Los datos históricos deben ser trazables

## Descripción

Toda operación financiera y operativa debe mantener trazabilidad histórica.

---

## Normas de integración con IA

## Regla: La IA no puede eludir las validaciones empresariales

## Descripción

Los agentes IA y módulos NLP no pueden persistir información sin pasar validaciones del negocio.

---

## Regla: Sigue siendo necesaria la supervisión humana

## Descripción

Las decisiones críticas del sistema permanecen bajo supervisión humana.

---

## Estado actual

El sistema continúa evolucionando hacia una arquitectura más robusta enfocada en:

- Consistencia
- Automatización segura
- Desacoplamiento
- Escalabilidad
- Integridad transaccional
- Procesamiento confiable