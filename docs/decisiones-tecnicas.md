#  Decisiones Técnicas
Condimentos El Colibrí - Inventory Management System

---

## 1. Elección de Arquitectura Cliente-Servidor

Se decidió separar frontend y backend para:

- Mantener separación clara de responsabilidades
- Permitir escalabilidad independiente
- Facilitar mantenimiento futuro
- Permitir múltiples clientes (web y móvil)

Esta decisión permite migrar el frontend sin afectar la lógica de negocio.

---

## 2. Elección de Node.js + Express.js

Se eligió Node.js por:

- Alto rendimiento en operaciones I/O
- Facilidad para crear APIs REST
- Gran ecosistema
- Curva de desarrollo rápida

Express.js se utiliza por su simplicidad y modularidad.

---

## 3. Uso de Arquitectura Basada en Servicios

La lógica de negocio no se coloca directamente en las rutas.

Se creó una capa de servicios para:

- Mejorar mantenibilidad
- Permitir testing futuro
- Evitar duplicación de lógica
- Separar controladores de reglas de negocio

Esto facilita una futura migración a microservicios si el sistema crece.

---

## 4. Elección de Firebase Firestore (NoSQL)

Se eligió Firestore en lugar de una base de datos relacional por:

- Escalabilidad automática
- Integración sencilla con entorno cloud
- Baja complejidad operativa
- Adecuado para volumen actual del negocio

Se adoptó un modelo basado en documentos con denormalización controlada.

---

## 5. Denormalización Estratégica

En las ventas se almacenan datos duplicados como:

- nombre del producto
- precio al momento de la venta

Esto evita inconsistencias históricas si el precio cambia en el futuro.

Se priorizó eficiencia de lectura sobre normalización estricta.

---

## 6. Cálculo de Ganancias solo con aprovacion

Las ganancias se calculan y almacenan en el documento Ganancias, solo cuando se aprueba el proceso de cierre.

Razones:

- Evitar recálculos constantes
- Control total basado en lógica del negocio
- Mantener integridad histórica

---

## 7. Implementación de Jobs para Procesos Contables

Se implementaron procesos automáticos para:

- Procesar pedidos pendientes
- Validar estados contables
- Calcular totales

Esto desacopla procesos críticos del flujo principal de la aplicación.

---

## 8. Manejo de Roles

Se implementó diferenciación entre:

- Administrador
- Operador

Se decidió no permitir lógica crítica en el frontend.
Toda validación importante ocurre en backend.

---

## 9. Preparación para Escalabilidad

La arquitectura actual permite:

- Implementar autenticación JWT
- Añadir sistema de auditoría
- Integrar reportes exportables
- Implementar CI/CD
- Migrar a contenedores Docker en el futuro