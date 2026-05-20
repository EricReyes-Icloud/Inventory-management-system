<div align="center">

<img src="./imgs/Miniatura Inventory-management-system.png" />

## Inventory Management System

<p>
Sistema de gestión de inventario desarrollado para una empresa real del sector alimenticio, enfocado en automatización operativa, control contable y arquitectura escalable.
</p>

</div>

---

## Descripción

Inventory Management System es una aplicación web diseñada para digitalizar y automatizar el control de inventario, ventas y procesamiento contable de **Condimentos El Colibrí**.

El proyecto nace a partir de una necesidad real de la empresa, la cual realizaba sus procesos manualmente, generando:

- Pérdida de tiempo.
- Errores de inventario.
- Dificultad para calcular ganancias.
- Baja trazabilidad de ventas.

El sistema busca resolver estos problemas mediante automatización, centralización de datos y procesamiento inteligente de operaciones.

---

## Problema que resuelve

La empresa aún maneja:

- Inventarios manuales.
- Registros físicos.
- Control deficiente de productos y ventas.

Esto genera:

- Inconsistencias de stock.
- Errores humanos.
- Pérdida de información.
- Poca escalabilidad.
- Baja capacidad de análisis financiero.

Inventory Management System transforma estos procesos en un flujo digital centralizado y automatizado.

---

## Stack Tecnologico

### Frontend
- React
- HTML
- CSS

### Backend
- Node.js
- Express.js

### Database
- Firebase Firestore

### Testing
- Vitest

### Toolings
- Git
- GitHub
- OpenCode
- Ollama

---

## Arquitectura

El proyecto sigue una arquitectura modular basada en separación de responsabilidades.

### Arquitectura General

```text
Frontend (React)
        ↓
REST API (Express.js)
        ↓
Services Layer
        ↓
Firebase Firestore
```

### Principios utilizados

- Modular Architecture.
- Separation of Concerns.
- Service Layer Pattern.
- Scalable Folder Structure.
- Reusable Business Logic.
- Centralized Validation.
- Automated Processing Flows.

---

## Estructura general del proyecto

```text
inventory-management-system/
│
├── Frontend/               # Frontend React
├── Backend/                # Backend Express
|    │
|    ├── services/               # Logica de negocio
|    ├── routes/                 # Rutas de la API
|    ├── utils/                  # Utilidades compartidas
|    ├── tests/                  # Tests automatizados
|
├── docs/                   # Documentación tecnica
│
└── README.md
```

---

## Testing

El proyecto incluye testing automatizado para validar reglas de negocio críticas.

### Cobertura actual

- Procesamiento contable.
- Validaciones de pedidos.
- Reglas de inventario.
- Casos límite operativos.

### Tecnología

- Vitest

---

## Deployment

El proyecto está diseñado para despliegue cloud-based.

### Posibles plataformas

#### Frontend
- Vercel
- Netlify

#### Backend
- Render
- Railway

#### Database
- Firebase Firestore

---

## Desarrollado asistido por IA

Este proyecto incorpora integración estratégica de inteligencia artificial como parte del flujo de desarrollo.

### Uso de IA en el proyecto

- Arquitectura asistida por IA.
- Automatización de testing.
- Generación de documentación técnica.
- Soporte para agentes IA mediante `AGENTS.md`.
- Integración profesional con OpenCode.

### Filosofía

La IA es utilizada como herramienta de productividad y aceleración técnica, mientras que las decisiones arquitectónicas, validaciones y dirección del proyecto son realizadas manualmente.

El objetivo es hacer uso de un enfoque moderno de desarrollo dirigido por especificaciones donde el desarrollador lidera y supervisa el uso de IA dentro de un ecosistema profesional.

---

## Filosofía del proyecto

Este proyecto no busca únicamente "funcionar".

Está diseñado para:

- Aplicar buenas prácticas reales.
- Construir arquitectura mantenible.
- Implementar automatización inteligente.
- Desarrollar habilidades de software profesional.

El enfoque principal es crear un sistema escalable, entendible y alineado con prácticas modernas de desarrollo de software.

---

## Estado del proyecto

En desarrollo activo.

Actualmente el proyecto continúa evolucionando en:

- Arquitectura.
- Testing.
- Automatización.
- Integración con IA.
- Experiencia de usuario.

---

## Autor

Desarrollado por <strong>Eric Reyes</strong>.
