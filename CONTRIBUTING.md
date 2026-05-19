## Guía para colaboradores

## Resumen

Este documento describe las convenciones y flujo de trabajo utilizados en Inventory Management System.

El objetivo es mantener:

- Consistencia de desarrollo
- Organización del repositorio
- Trazabilidad de cambios
- Integración segura
- Colaboración estructurada

---

## Estrategia de Git Flow

El proyecto utiliza una estrategia basada en ramas, orientada a desarrollo organizado y escalable.

---

## Rama Main

## `main`

Representa la versión estable de producción.

### Reglas

- Debe permanecer estable
- No se realizan desarrollos directos
- Únicamente recibe merges validados a traves de Pull Request

---

## `develop`

Rama principal de integración.

### Objetivo

- Consolidar funcionalidades
- Validar integración
- Preparar releases futuras

---

## Ramas Feature 

Las nuevas funcionalidades se desarrollan mediante ramas feature.

---

## Convención de nomenclatura

```text
feature/<feature-name>
```

### Ejemplo

```text
feature/testing-automatico
feature/ia-integration
feature/accounting-refactor
```

---

## Objetivo

Permitir:

- Desarrollo aislado
- Testing independiente
- Integración controlada
- Menor riesgo de regresiones

---

## Flujo de trabajo en el desarrollo

```text
feature/*
   ↓
Pull Request
   ↓
develop
   ↓
Pull Request
   ↓ 
main
```

---

## Uso de Git Stash

El proyecto utiliza:

```bash
git stash
```

para almacenar cambios temporales durante el desarrollo continuo.

---

## Casos de uso habituales

- Cambio rápido entre ramas
- Interrupciones de desarrollo
- Pruebas temporales
- Recuperación segura de trabajo incompleto

---

## Ejemplo

```bash
git stash
git checkout develop
```

---

## Reglas para Pull Request

Todas las Pull Requests siguen una estructura estandarizada.

---

## Estructura de PR requerida

## 1. Descripción

Describe:

- Objetivo del cambio
- Problema resuelto
- Contexto técnico

---

## 2. Changes Made (Cambios realizados)

Lista detallada de:

- Archivos modificados
- Funcionalidades agregadas
- Refactorizaciones
- Validaciones implementadas

---

## 3. Impact (Impacto)

Explica:

- Impacto técnico
- Impacto funcional
- Posibles riesgos
- Áreas afectadas

---

## 4. Notes (Notas)

Información adicional relevante.

### Incluye

- Limitaciones
- Decisiones técnicas
- Mejoras futuras
- Observaciones importantes

---

## Ejemplo de la estructura para una Pull Request

```md
## Description
Adds automatic accounting validation flow.

---

## Changes Made
- Added accounting validation service
- Refactored Firestore operations
- Improved inventory calculations

---

## Impact
Affects accounting processing and monthly historical updates.

---

## Notes
Future improvement planned using Firestore transactions.
```

---

## Convenciones para commits

El proyecto utiliza commits semánticos para mantener trazabilidad clara y profesional.

---

## Formato del commit

```text
tipo: pequeña descripción
```

---

## Tipos de commit utilizados

## `feat`

Nueva funcionalidad.

### Ejemplo

```text
feat: add accounting automation workflow
```

---

## `fix`

Corrección de errores.

### Ejemplo

```text
fix: resolve duplicated inventory update
```

---

## `docs`

Cambios en documentación.

### Ejemplo

```text
docs: update system design documentation
```

---

## `style`

Cambios visuales o de formato sin afectar lógica.

### Ejemplo

```text
style: improve component formatting
```

---

## `refactor`

Refactorización sin cambiar comportamiento funcional.

### Ejemplo

```text
refactor: separate firestore access layer
```

---

## `test`

Testing automatizado.

### Ejemplo

```text
test: add accounting service unit tests
```

---

## `chore`

Tareas menores de mantenimiento.

### Ejemplo

```text
chore: update dependencies
```

---

## `ci`

Cambios relacionados con integración continua.

### Ejemplo

```text
ci: configure github actions workflow
```

---

## `revert`

Reversión de cambios.

### Ejemplo

```text
revert: revert accounting optimization
```

---

## `merge`

Commits de integración o merge manual.

### Ejemplo

```text
merge: merge develop into feature/testing
```

---

## `wip`

Trabajo en progreso.

### Ejemplo

```text
wip: partial inventory refactor
```

---

## Reglas en la redacción de Commits

## Prácticas recomendadas

- Commits pequeños y claros
- Un objetivo por commit
- Mensajes descriptivos
- Evitar commits genéricos

---

## Evitar

```text
fix stuff  X
update code  X
changes  X
```

---

## Pruebas de Testing previas a la fusión

Antes de realizar merge se recomienda validar:

- Funcionamiento general
- Reglas críticas de negocio
- Procesamiento contable
- Validaciones operativas

---

## Filosofía de protección para las Ramas

El flujo de trabajo busca minimizar:

- Regresiones
- Conflictos innecesarios
- Código inestable en producción

---

## Desarrollo asistido por IA

El proyecto incorpora herramientas de IA como soporte de productividad y automatización técnica.

Sin embargo:

- Las decisiones arquitectónicas son humanas
- Las validaciones son manuales
- El control técnico permanece supervisado

---

## Objetivos a largo plazo

El flujo de contribución está diseñado para evolucionar hacia:

- Integración continua completa
- Pipelines automatizados
- Validaciones automáticas
- Testing obligatorio
- Despliegues controlados
- Arquitectura más robusta