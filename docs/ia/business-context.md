## Contexto de Negocio

## Resumen

Inventory Management System es un sistema desarrollado para resolver problemas operativos reales dentro de una empresa del sector alimenticio llamada:

```text
Condimentos El Colibrí
```

El sistema busca digitalizar y automatizar procesos que actualmente son realizados manualmente.

---

## Problema Principal

La empresa maneja actualmente:

- Inventarios manuales
- Registros físicos
- Cálculos financieros manuales
- Pedidos informales vía WhatsApp
- Poca trazabilidad histórica

Esto genera:

- Errores humanos
- Pérdida de tiempo
- Inconsistencias de inventario
- Dificultad para calcular ganancias reales
- Baja capacidad de análisis financiero

---

## Contexto Operativo

La operación del negocio gira alrededor de:

- Venta de productos alimenticios
- Manejo de categorías y SKUs
- Control de cartones vendidos
- Cálculo de ganancias por categoría
- Control histórico mensual

---

## Flujo Principal del Negocio

El flujo operativo principal es:

```text
Cliente
   ↓
Pedido vía WhatsApp
   ↓
Procesamiento NLP
   ↓
Registro de venta
   ↓
Actualización histórica
   ↓
Procesamiento contable
   ↓
Cierre mensual
```

---

## Objetivo del Sistema

El sistema NO es únicamente un CRUD.

El objetivo principal es:

- Automatizar procesos operativos
- Reducir errores manuales
- Generar trazabilidad financiera
- Mantener históricos mensuales
- Facilitar análisis operativos
- Centralizar información

---

## Núcleo Financiero

El sistema posee una fuerte orientación contable.

Las operaciones más importantes incluyen:

- Consolidación de ventas
- Cálculo de cartones vendidos
- Acumulados por categoría
- Ganancias mensuales
- Descuentos de costos operativos

---

## Filosofía del Proyecto

El proyecto busca evolucionar hacia:

- Arquitectura escalable
- Automatización robusta
- Procesamiento seguro
- Separación clara de responsabilidades
- Backend-driven logic
- Integración IA supervisada

---

## Rol de la IA Dentro del Proyecto

La IA es utilizada como:

- Herramienta de productividad
- Soporte de arquitectura
- Asistencia de documentación
- Automatización de desarrollo
- Apoyo para testing

La IA NO debe:

- Romper reglas de negocio
- Ignorar validaciones
- Alterar arquitectura sin justificación
- Introducir lógica insegura

---

## Restricciones Importantes

## Toda lógica crítica pertenece al backend

Incluyendo:

- Cálculos financieros
- Actualizaciones históricas
- Validaciones
- Consolidaciones

---

## Firestore es actualmente la base de datos principal

Toda propuesta técnica debe considerar:

- Estructura documental
- Costos de lectura/escritura
- Escalabilidad Firestore
- Atomicidad futura

---

## El sistema aún está evolucionando

Actualmente aún existen áreas pendientes de mejora:

- Transacciones
- Idempotencia
- Desacoplamiento avanzado
- Optimización de consultas
- Seguridad avanzada