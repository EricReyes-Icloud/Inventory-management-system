#  Arquitectura del Sistema
Condimentos El Colibrí - Inventory Management System

---

## 1. Visión General

El sistema está diseñado bajo una arquitectura cliente-servidor, separando claramente el frontend del backend y utilizando una base de datos en la nube para garantizar disponibilidad, escalabilidad y seguridad.

El objetivo principal es ofrecer una solución de gestión de inventario robusta, segura y preparada para crecimiento futuro.

---

## 2. Arquitectura General

Frontend (Flutter)
        ↓
Backend API (Node.js + Express.js)
        ↓
Firebase Firestore (Base de datos en la nube)

El frontend consume la API REST del backend.
El backend contiene toda la lógica de negocio.
Firestore almacena la información de productos, ventas y estados contables.

---

## 3. Backend

El backend está desarrollado en Node.js utilizando Express.js.

Se encuentra organizado bajo una arquitectura basada en servicios:

- routes → Definición de endpoints
- services → Lógica de negocio
- jobs → Procesos automáticos
- lib → Conexiones y configuración

### Principios aplicados:

- Separación de responsabilidades
- Modularidad
- Centralización de lógica contable
- Preparado para futura autenticación JWT

---

## 4. Frontend

Desarrollado en Flutter para permitir compatibilidad web y móvil.

El frontend:
- Consume la API del backend
- Gestiona estados de interfaz
- No contiene lógica de negocio crítica
- Respeta separación de capas

---

## 5. Base de Datos - Firestore

Se utiliza Firebase Firestore como base de datos NoSQL en la nube.

Colecciones principales:

- Productos
- Ventas
- Invertir
- Ganancias
- Usuarios

Razones de elección:
- Escalabilidad automática
- Alta disponibilidad
- Seguridad mediante reglas
- Fácil integración con backend Node.js

---

## 6. Procesos Automatizados (Jobs)

El sistema incluye procesos automáticos encargados de:

- Procesamiento contable de pedidos
- Validación de estados
- Cálculo de totales

Estos procesos permiten desacoplar operaciones críticas del flujo principal de la aplicación.

---

## 7. Seguridad y Roles

El sistema contempla dos roles principales:

- Administrador
- Operador

El administrador tiene control total.
Los operadores pueden registrar ventas y consultar información.

En futuras versiones se implementará autenticación basada en tokens (JWT).

---

## 8. Escalabilidad Futura

La arquitectura permite:

- Implementar autenticación robusta
- Migrar a microservicios si el negocio crece
- Integrar dashboard analítico
- Añadir sistema de reportes exportables
- Implementar CI/CD

La separación frontend/backend facilita futuras integraciones.


## 9. Diagrama de arquitectura

![Arquitectura](./images/Diagrama%20de%20arquitectura.png)


##  Estado Actual

Actualmente el sistema se encuentra en desarrollo activo.
La arquitectura puede evolucionar conforme se implementen nuevas funcionalidades.