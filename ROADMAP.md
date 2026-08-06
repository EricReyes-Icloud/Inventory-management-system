## Hoja de ruta

## Resumen

Este documento describe la evolución, estado actual y dirección futura de Inventory Management System.

Más que una simple lista de tareas, este roadmap documenta:

- El proceso de construcción del sistema
- Las decisiones técnicas tomadas
- La evolución arquitectónica
- Los objetivos futuros del proyecto

El sistema fue construido siguiendo un enfoque progresivo basado en:

- Entendimiento del negocio
- Arquitectura modular
- Automatización
- Separación de responsabilidades
- Escalabilidad futura

---

## Fase 1: Análisis empresarial y requisitos

## Objetivo

Comprender el problema real del cliente y definir los requerimientos mínimos viables del sistema.

---

## Proceso

Se realizó una reunión directa con el cliente para:

- Entender el flujo operativo actual
- Identificar problemas existentes
- Detectar limitaciones del proceso manual
- Definir necesidades prioritarias

---

## Problemas identificados

- Inventario manual
- Pérdida de trazabilidad
- Dificultad para calcular ganancias
- Poca organización financiera
- Procesos lentos y repetitivos

---

## Resultado

Se definieron los requerimientos iniciales del sistema:

- Control de inventario
- Registro de ventas
- Cálculo de ganancias
- Automatización contable
- Historial mensual
- Integración WhatsApp

---

## Fase 2 — Diseño de la base de datos en Firestore

## Objetivo

Diseñar la estructura de base de datos acorde a los requerimientos del negocio.

---

## Proceso

Se realizó un análisis profundo para determinar:

- Colecciones necesarias
- Relaciones documentales
- Estructura jerárquica
- Organización histórica mensual

---

## Tecnologías

- Firebase Firestore

---

## Resultado

Se construyó la estructura inicial de colecciones:

```text
Ventas
Total Productos
Cartones_vendidos
Ganancias
```

---

## Principios de diseño

- Segmentación mensual
- Trazabilidad histórica
- Organización jerárquica
- Separación operacional

---

## Fase 3 — Investigación sobre la arquitectura del sistema

## Objetivo

Investigar y definir la arquitectura ideal para el sistema.

---

## Proceso

Se realizó investigación profunda sobre:

- Patrones arquitectónicos
- Diseño de software
- Separación de responsabilidades
- Modularidad
- Mantenibilidad

---

## Material de referencia

La investigación fue guiada parcialmente utilizando el algoritmo compartido por:

### Martin Cristobal Balasch

Especialista en arquitectura y diseño de software.

### Algoritmo:
https://drive.google.com/file/d/1gKM7-XWyKr3SoStZjI_VgXGMqTH02vmP/view?pli=1

---

## Resultado

Se concluyó que la arquitectura más adecuada para el proyecto era:

```text
Modular Monolith Architecture
```

o enfoque:

```text
Modular Client-Server Architecture
```

---

## Fase 4 — Construcción de la arquitectura básica

## Objetivo

Construir la arquitectura base del backend.

---

## Proceso

Se implementaron las capas principales del sistema:

```text
services/
routes/
```

---

## Objectivo

Garantizar:

- Separación de responsabilidades
- Lógica desacoplada
- Mantenibilidad
- Reutilización

---

## Características iniciales

Se desarrollaron inicialmente:

- endpoints de productos
- endpoints de ventas

---

## Fase 5 — Estructuración completa del sistema

## Ojetivo

Expandir la arquitectura hacia un diseño más robusto y modular.

---

## Se han añadido nuevas capas

### `utils/`

Funciones reutilizables compartidas.

---

### `lib/`

Capa de conexión y acceso a Firestore.

---

### `jobs/`

Procesos automáticos y tareas programadas.

---

### `brain/`

Interpretación NLP y automatización inteligente.

---

## Resultado

El sistema evolucionó hacia una arquitectura mucho más organizada y escalable.

---

## Fase 6 — Integración con WhatsApp

## Objetivo

Permitir pedidos automáticos vía WhatsApp.

---

## Tecnologías

- Twilio API

---

## Funcionalidades añadidas

- Recepción de mensajes
- Webhook backend
- Integración operativa
- Automatización de pedidos

---

## Resultado

El cliente puede realizar pedidos utilizando lenguaje natural desde WhatsApp.

---

## Fase 7 — NLP y automatización contable

## Objetivo

Automatizar interpretación de pedidos y procesamiento contable.

---

## Componentes desarrollados

### `inturis.js`

Motor NLP responsable de:

- Interpretar mensajes
- Detectar productos
- Detectar cantidades
- Estructurar pedidos

---

### `JobContableMensual.js`

Controlador de automatización contable.

Responsable de:

- Consolidación histórica
- Procesamiento automático
- Actualización de acumulados

---

## Fase 8 — Servicios de lógica empresarial

## Objetivo

Centralizar reglas de negocio y cálculos críticos.

---

## Servicios añadidos

### `contabilidad.service.js`

Responsable de:

- Cálculos contables
- Consolidación operativa
- Procesamiento financiero

---

### `ganancias.service.js`

Responsable de:

- Cálculo de ganancias
- Cierres mensuales
- Consolidación financiera

---

## Objetivo arquitectónico

Mantener:

- Separación de responsabilidades
- Lógica desacoplada
- Backend-centric processing

---

## Fase 9 — Etapa actual de desarrollo

## Tema central

El proyecto actualmente se encuentra en una etapa crítica de fortalecimiento técnico.

---

## Prioridad 01 — Pruebas automatizadas

## Objetivo

Garantizar integridad, mantenibilidad y estabilidad del sistema.

---

## Trabajo actual

- Unit testing
- Validación de reglas de negocio
- Testing de procesos contables
- Protección contra regresiones

---

## Planes futuros

### Integración CI/CD

Implementar:

- GitHub Actions
- Validaciones automáticas
- Pipelines de testing
- Control de integración

---

## Prioridad 02 — Refactoricación del código

## Objetivo

Fortalecer arquitectura y calidad técnica del sistema.

---

## Debilidades actuales identificadas

### Separación de responsabilidades

Algunas responsabilidades aún necesitan mayor desacoplamiento.

---

### Lógica reutilizable

Existen oportunidades de centralización lógica.

---

### Persistencia de datos

Se requieren mejoras en manejo consistente de persistencia.

---

### Optimización de Firestore

Optimizar:

- Consultas
- Estructura documental
- Lecturas frecuentes

---

### Transacciones y atomicidad

Actualmente el sistema aún no implementa completamente:

- Transacciones
- Atomicidad
- Rollback
- Control robusto de concurrencia

---

### Escalabilidad

Se planean mejoras orientadas a:

- Idempotencia
- Desacoplamiento de Firestore
- Procesamiento más seguro
- Escalabilidad futura

---

## Prioridad 03 — Consolidación del backend

## Trabajos previstos

Después de completar testing y refactorización se planea realizar los siguientes procesos:

- Cierre mensual administrativo
- Validaciones completas
- Pruebas integrales backend
- Consolidación operativa

---

## Fase 10 — Planificación del front-end, la experiencia de usuario (UX) y la interfaz de usuario (UI)

## Objetivo

Iniciar construcción visual y experiencia de usuario del sistema.

---

## Tecnologías

- React

---

## Proceso previsto

Reunión con el cliente para definir:

- Módulos frontend
- Experiencia de usuario
- Diseño visual
- Colores
- Tipografía
- Branding
- Estructura visual

---

## Estrategia de UX/UI

El diseño será guiado mediante:

- Wireframes
- Validación del cliente
- Adaptación al flujo operativo real

---

## Roadmap Futuro

## Mejoras técnicas previstas

### Transacciones de Firestore

Garantizar consistencia y atomicidad.

---

### Procesamiento idempotente

Evitar procesamiento duplicado.

---

### Tareas basadas en colas

Procesamiento asincrónico más robusto.

---

### Autenticación basada en roles

Sistema completo de autenticación y permisos.

---

### Reglas avanzadas de Firestore

Seguridad documental más robusta.

---

### Pipeline completo de CI/CD

Automatización completa de integración y despliegue.

---

### Panel de control para el frontend

Visualización administrativa moderna y escalable.

---

### Flujos operativos asistidos por IA

Evolución futura de automatización inteligente.

---

## Filosofía de desarrollo

El proyecto sigue una filosofía centrada en:

- Entendimiento profundo del negocio
- Arquitectura modular
- Evolución progresiva
- Automatización segura
- Buenas prácticas reales
- Aprendizaje técnico continuo

---

## Estado actual

```text
Backend Core:               En desarrollo
Testing Automatizado:       En progreso
Refactorización:            En progreso
Frontend React:             Planeado
CI/CD:                      Planeado
Escalabilidad avanzada:     Planeado
Producción estable:         Objetivo futuro
```
