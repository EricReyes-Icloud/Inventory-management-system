## Registro de cambios

Todos los cambios importantes de este proyecto serán documentados en este archivo.

El proyecto sigue una evolución progresiva basada en arquitectura modular, automatización y buenas prácticas de ingeniería de software.

---

## [Unreleased]

## Agregado

### Arquitectura Base
- Implementación de arquitectura modular tipo Monolito Modular / Cliente-Servidor.
- Creación de la capa `services/` para centralización de lógica de negocio.
- Creación de la capa `routes/` para manejo de endpoints HTTP.
- Implementación de separación de responsabilidades entre rutas, servicios y acceso a datos.
- Definición de estructura escalable para backend.

---

### Base de Datos
- Diseño completo de base de datos en Firebase Firestore.
- Implementación de estructura documental jerárquica.
- Organización histórica por mes/año.
- Creación de colecciones:
  - `Ventas`
  - `Total Productos`
  - `Cartones_vendidos`
  - `Ganancias`

---

### Integración con WhatsApp
- Integración inicial con API de Twilio.
- Implementación de recepción de pedidos vía WhatsApp.
- Configuración de webhooks backend para procesamiento de mensajes.

---

### Procesamiento NLP
- Creación de `inturis.js`.
- Implementación de interpretación NLP de pedidos.
- Detección automática de:
  - productos
  - cantidades
  - estructura del pedido
- Conversión de lenguaje natural a datos procesables.

---

### Automatización Contable
- Implementación de `JobContableMensual.js`.
- Automatización de procesamiento contable.
- Actualización automática de históricos mensuales.
- Consolidación automática de ventas por:
  - categoría
  - SKU
- Registro automático de cartones vendidos.

---

### Servicios de Negocio
- Implementación de `contabilidad.service.js`.
- Implementación de `ganancias.service.js`.
- Centralización de lógica financiera.
- Separación de cálculos críticos hacia backend.

---

### Infraestructura Interna
- Creación de capa `utils/` para funciones reutilizables.
- Creación de capa `lib/` para desacoplar acceso a Firestore.
- Creación de capa `jobs/` para procesos automáticos.
- Creación de capa `brain/` para automatización e interpretación inteligente.

---

### Endpoints Iniciales
- Desarrollo de endpoints para:
  - productos
  - ventas
  - administración
  - botones administrativos
  - integración WhatsApp

---

### Documentación Técnica
- Creación de:
  - `README.md`
  - `SYSTEM_DESIGN.md`
  - `API_DOCUMENTATION.md`
  - `DATABASE_SCHEMA.md`
  - `DOMAIN_RULES.md`
  - `CONTRIBUTING.md`
  - `ROADMAP.md`
  - documentación de workflows

---

### Testing
- Configuración inicial de Vitest.
- Inicio de testing automatizado para reglas de negocio.
- Implementación de pruebas sobre:
  - procesos contables
  - validaciones operativas
  - lógica financiera

---

### Git & Workflow
- Implementación de GitFlow basado en:
  - `main`
  - `develop`
  - `feature/*`
- Uso de commits semánticos.
- Estructuración profesional de Pull Requests.
- Uso de `git stash` para manejo de cambios temporales.

---

## Refactorizado

### Arquitectura
- Reorganización progresiva del backend hacia una arquitectura más desacoplada.
- Separación de lógica crítica fuera de las rutas HTTP.
- Centralización de lógica reutilizable.

---

### Firestore
- Mejora progresiva del desacoplamiento de acceso a Firestore.
- Optimización inicial de estructura documental.
- Reorganización de históricos mensuales.

---

### Procesamiento Contable
- Separación de cálculos financieros hacia services especializados.
- Reestructuración de flujo automático contable.

---

## Cambiado

### Flujo Operativo
- Migración de procesos manuales hacia automatización backend.
- Integración de procesamiento NLP dentro del flujo principal de pedidos.

---

### Diseño del Sistema
- Evolución desde estructura básica hacia arquitectura modular escalable.
- Fortalecimiento de separación de responsabilidades.

---

## En Progreso

### Testing
Actualmente se trabaja en:

- Testing de reglas críticas
- Protección contra regresiones
- Validaciones automatizadas
- Pruebas de integridad operacional

---

### Refactorización
Actualmente se trabaja en mejoras relacionadas con:

- Desacoplamiento
- Mantenibilidad
- Reutilización lógica
- Consistencia operativa
- Optimización Firestore

---

### Frontend
Inicio de planificación frontend utilizando:

- React
- UX/UI personalizada
- Wireframes
- Diseño enfocado en flujo operativo real

---

## Planeado

### Escalabilidad
Implementaciones futuras:

- Operaciones atómicas
- Transacciones Firestore
- Procesamiento idempotente
- Control de concurrencia
- Jobs asincrónicos
- Queue processing

---

### Seguridad
Mejoras futuras:

- Autenticación JWT
- Control de roles
- Validaciones avanzadas
- Reglas robustas Firestore
- Auditoría de operaciones

---

### Infraestructura
Planeado implementar:

- CI/CD
- GitHub Actions
- Validaciones automáticas
- Pipelines de integración
- Despliegue automatizado

---

### Frontend
Planeado desarrollar:

- Dashboard administrativo
- Visualización de métricas
- Control visual de inventario
- Experiencia responsive
- Interfaz moderna para operadores y administradores

---

### Inteligencia Artificial
Evolución futura hacia:

- Automatización inteligente
- Agentes IA especializados
- Mejora del procesamiento NLP
- Flujos asistidos por IA

---

## Filosofía de Desarrollo

El proyecto se desarrolla bajo principios de:

- Arquitectura modular
- Separación de responsabilidades
- Automatización segura
- Escalabilidad progresiva
- Trazabilidad operativa
- Aprendizaje continuo
- Uso estratégico de IA bajo supervisión humana

---

## Estado Actual

```text
Backend Core:               En desarrollo
Testing Automatizado:       En progreso
Refactorización:            En progreso
Frontend React:             Planeado
CI/CD:                      Planeado
Escalabilidad avanzada:     Planeado
Producción estable:         Objetivo futuro
```
