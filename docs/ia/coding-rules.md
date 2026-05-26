## Reglas de Código

## Resumen

Estas reglas definen cómo debe escribirse el código dentro del proyecto.

El objetivo es mantener:

- Consistencia
- Mantenibilidad
- Claridad
- Desacoplamiento
- Escalabilidad

---

## Arquitectura

## Regla: Separación de Responsabilidades

Las responsabilidades deben permanecer separadas.

---

## `routes/`

Solo deben:

- Recibir requests
- Validar entrada básica
- Llamar services
- Responder HTTP

Las rutas NO deben contener:

- Lógica contable
- Cálculos complejos
- Acceso directo complejo a Firestore

---

## `services/`

Contienen:

- Lógica de negocio
- Cálculos
- Validaciones operativas
- Consolidaciones

---

## `lib/`

Responsable únicamente de:

- Conexión Firestore
- Configuración infraestructura

---

## `utils/`

Solo funciones reutilizables puras.

---

## `jobs/`

Solo automatización y coordinación de procesos automáticos.

---

## Reglas del Backend 

## Toda lógica crítica debe ejecutarse en backend

Incluyendo:

- Cálculos financieros
- Procesamiento contable
- Actualizaciones históricas
- Validaciones importantes

---

## Reglas de Firestore 

## No duplicar lógica Firestore

El acceso a Firestore debe mantenerse desacoplado y reutilizable.

---

## Evitar queries innecesarias

Toda consulta debe considerar:

- Performance
- Costo Firestore
- Escalabilidad

---

## Preparar código para atomicidad futura

Aunque actualmente no existan transacciones completas.

---

## Reglas de Testing

## Toda lógica crítica debe ser testeable

El código debe escribirse permitiendo:

- Unit testing
- Mocking
- Aislamiento lógico

---

## Evitar lógica imposible de testear

No mezclar:

- HTTP
- Firestore
- Lógica de negocio
- Automatización

en una sola función.

---

## Reglas para la IA

## La IA no debe romper arquitectura existente

Toda modificación debe respetar:

- Separación de responsabilidades
- Estructura modular
- Dominio del negocio

---

## La IA no debe introducir lógica insegura

Evitar:

- Acceso inseguro Firestore
- Lógica duplicada
- Cálculos frontend
- Hardcoded secrets

---

## Reglas de nomenclatura

## Variables

Usar nombres descriptivos.

### ✅ Correcto

```js
totalCartonesVendidos
gananciasMensuales
productosProcesados
```

### ❌ Incorrecto

```js
x
data
temp
```

---

## Funciones

Las funciones deben describir exactamente lo que hacen.

### ✅ Correcto

```js
calcularGananciasMensuales()
procesarPedidoWhatsapp()
```

---

## Reglas para escribir código limpio

## Evitar funciones gigantes

Dividir lógica compleja en funciones pequeñas.

---

## Evitar duplicación

Centralizar lógica reutilizable.

---

## Mantener legibilidad

Priorizar claridad sobre complejidad innecesaria.

---

## Reglas Futuras Planeadas

El código debe prepararse para futura implementación de:

- Transacciones
- Idempotencia
- Colas
- Concurrencia segura
- CI/CD
- Autenticación robusta