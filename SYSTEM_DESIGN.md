## Diseño del sistema

### Resumen

Inventory Management System es un sistema orientado a la automatización de procesos operativos y contables para Condimentos El Colibrí.

La arquitectura actual está diseñada con un enfoque modular basado en separación de responsabilidades, permitiendo mantener el sistema organizado, entendible y preparado para futuras mejoras de escalabilidad y robustez.

---

## Arquitectura General

La aplicación sigue una arquitectura modular basada en servicios donde cada módulo tiene responsabilidades específicas.

### Arquitectura actual

```text
Client Application
        ↓
Express API (Routes)
        ↓
Services Layer
        ↓
Firebase Firestore
```

---

## Estructura actual del proyecto

```text
backend/
│
├── src/
│   ├── brain/          # Interpretación inteligente de pedidos en lenguaje natural
│   ├── jobs/           # Procesos automáticos y tareas programadas
│   ├── lib/            # Configuración y acceso a Firestore
│   ├── routes/         # Endpoints de la API
│   ├── secrets/        # Configuración sensible
│   ├── services/       # Lógica de negocio
│   ├── utils/          # Utilidades compartidas
│   ├── whatsapp/       # Integración de WhatsApp
│   └── index.js        # Punto de entrada principal
│
├── tests/              # Testing automatizado
│
├── vitest.config.js
├── package.json
└── tsconfig.json
```

---

## Capas del sistema

### 1. Capa de la API (`routes/`)

Responsable de:

- Recibir requests HTTP
- Validar entrada básica
- Delegar lógica a servicios
- Responder al cliente

### Objetivo

Mantener las rutas ligeras y desacopladas de la lógica de negocio.

---

### 2. Capa de servicio (`services/`)

Contiene la lógica principal del sistema.

Responsable de:

- Procesamiento contable
- Reglas de negocio
- Validaciones operativas
- Actualización de inventario

### Objetivo

Centralizar la lógica reutilizable y evitar duplicación de código.

---

### 3. Capa de infraestructura (`lib/`)

Abstracción del acceso a Firebase Firestore.

Responsable de:

- Inicialización de Firebase
- Conexión con Firestore

### Objetivo

Desacoplar el acceso a base de datos de la lógica de negocio.

---

### 4. Capa de automatización (`jobs/`)

Procesos automáticos y tareas asincrónicas.

Responsable de:

- Ejecución de procesos internos
- Procesamiento contable automático
- Sincronización de operaciones

### Objetivo

Tener un sistema asincrónico, mas un mecanismo de control manual por administrador.

---

### 5. Capa de Integración (`whatsapp/`)

Módulo destinado a integraciones externas.

Responsable de:

- Procesamiento de pedidos recibidos por WhatsApp
- Automatización futura de mensajes y flujos

### Objetivo

Mayor felxibilidad en el flujo normal del negocio.

---

### 6. Capa de utilidades (`utils/`)

Funciones reutilizables compartidas entre módulos.

### Objetivo

Separación clara de responsabilidades con funciones reutilizables.

---

### 7. Capa Brain (`brain/`)

Capa orientada a la interpretación inteligente de pedidos generados en lenguaje natural y futura integración con IA.

Actualmente en evolución.

---

## Flujo de datos

### Flujo general del sistema

```text
Usuario
   ↓
HTTP Request
   ↓
Routes
   ↓
Services
   ↓
Firestore Layer
   ↓
Firebase Firestore
```

---

### Flujo de procesamiento contable

```text
Nueva venta
    ↓
Validación de datos
    ↓
Interpretación del pedido
    ↓ 
Registro de ventas
    ↓        
Ejecución del Job Automatico
    ↓       
Procesamiento de reglas contables
    ↓
Actualización de inventario
    ↓
Registro histórico
    ↓
Persistencia en Firestore
```

---

## Responsabilidades

### Routes
- Comunicación HTTP
- Manejo de requests/responses

### Services
- Reglas de negocio
- Procesamiento operativo

### Lib
- Acceso a Firestore
- Configuración de infraestructura

### Jobs
- Automatización
- Procesamiento programado
- Coordinación del sistema

### WhatsApp
- Integraciones externas
- Entrada automatizada de pedidos

### Tests
- Validación automatizada
- Protección de reglas críticas

---

## Escalabilidad

Actualmente el sistema se encuentra en una etapa de evolución arquitectónica.

La estructura modular actual fue diseñada para facilitar futuras mejoras de escalabilidad sin necesidad de reescribir completamente el sistema.

---

## Mejoras previstas

### Procesamiento idempotente
Implementar mecanismos de idempotencia para evitar procesamiento duplicado de pedidos y operaciones contables.

### Operaciones Atómicas
Migrar operaciones críticas hacia flujos más seguros utilizando transacciones y operaciones atómicas de Firestore.

### Gestión de transacciones
Incorporar manejo robusto de transacciones para garantizar consistencia de datos en operaciones concurrentes.

### Optimización de rendimiento (Performance)
Optimizar consultas y estructura documental en Firestore para mejorar:

- Tiempos de respuesta
- Consumo de lecturas
- Escalabilidad operativa

### Acceso a datos desacoplado
Fortalecer la abstracción del acceso a Firestore para permitir:

- Mejor mantenibilidad
- Testing más simple
- Posibilidad futura de migrar infraestructura a traves de una capa `repository`

### Procesamiento basado en Colas (Futuro)
Evaluar procesamiento asíncrono mediante colas para tareas críticas y automatizaciones de alto volumen.

---

## Seguridad

Actualmente el sistema implementa una estructura básica de separación de responsabilidades.

Sin embargo, varias mejoras de seguridad forman parte del roadmap técnico del proyecto.

---

## Objetivos actuales en materia de seguridad

### Aislamiento ambiental
Uso de variables de entorno para proteger credenciales sensibles.

### Acceso controlado
Separación de roles administrativos y operativos.

### Lógica centrada en el Backend
La lógica crítica se procesa desde backend para evitar manipulación desde cliente.

---

## Mejoras de seguridad previstas

### Autenticación y autorización
Implementación futura de:

- Autenticación con JWT
- Permisos basados en roles
- Validación de sesiones

### Reglas de seguridad en Firestore
Diseño de reglas más robustas para restringir acceso indebido a datos.

### Validación de solicitudes
Fortalecer validaciones de entrada y seguridad de los datos.

### Registro de auditoría
Registrar eventos críticos y operaciones sensibles del sistema.

---

## Desiciones Tecnicas

### ¿Por qué React?
Elegido por:

- Ecosistema moderno
- Alta demanda profesional
- Flexibilidad
- Facilidad de escalabilidad frontend

---

### ¿Por qué Node.js + Express?
Elegido por:

- Simplicidad
- Velocidad de desarrollo
- Arquitectura flexible
- Integración natural con JavaScript

---

### ¿Por qué Firebase Firestore?
Elegido por:

- Facilidad de integración
- Persistencia cloud
- Escalabilidad inicial
- Rapidez de desarrollo MVP

---

### ¿Por qué una arquitectura basada en servicios?
Para lograr:

- Desacoplamiento
- Mantenibilidad
- Reutilización
- Testing más simple
- Mejor organización del proyecto

---

## Estrategia de Testing

El sistema incorpora testing automatizado enfocado en reglas críticas de negocio.

### Objetivos

- Prevenir regresiones
- Validar lógica contable
- Asegurar integridad operativa

### Tecnologías

- Vitest

---

## Integración con IA

El proyecto incluye una arquitectura preparada para futura integración con IA y automatización inteligente.

Actualmente se utilizan herramientas de IA para:

- Automatización de desarrollo
- Asistencia arquitectónica
- Testing
- Documentación técnica

La dirección técnica y validación de decisiones permanece bajo supervisión humana.

---

## Estado actual

El sistema continúa evolucionando hacia una arquitectura más robusta orientada a:

- Consistencia transaccional
- Automatización avanzada
- Mejor escalabilidad
- Procesamiento seguro
- Integración con IA más profunda