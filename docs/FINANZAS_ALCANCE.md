# Alcance del perfil Finanzas

## Objetivo

Finanzas valida la disponibilidad presupuestal de una requisicion despues de que Compras ya termino el cuadro comparativo y dejo definida la seleccion/propuesta de compra.

El perfil no reemplaza a Compras. Compras conserva cotizaciones, proveedores, cuadro comparativo, orden y datos comerciales. Finanzas agrega la validacion presupuestal y la clasificacion financiera antes del cierre final.

## Punto de entrada

El punto de entrada recomendado es despues del estado `Compra` (`statuses_id = 13`) y antes de `Finalizada` (`statuses_id = 11`).

Flujo actual relevante:

1. `Cotizacion` (`12`): Compras gestiona cotizaciones.
2. `Revision` (`14`): Compras Admin revisa cuadro comparativo.
3. `Compra` (`13`): seleccion final completa y proceso de compra.
4. `Finalizada` (`11`): cierre actual.

Flujo con Finanzas:

1. `Compra` (`13`): Compras deja lista la orden/propuesta.
2. `Finanzas` (`15`): Finanzas valida presupuesto y clasificacion.
3. `Aprobada por Finanzas` (`16`): habilita cierre final.
4. `Finalizada` (`11`): cierre final despues de aprobacion financiera.

## Responsabilidad de Finanzas

Finanzas debe poder revisar:

- Folio y dependencia solicitante.
- Partidas solicitadas.
- Proveedor(es) seleccionados.
- Montos seleccionados en cuadro comparativo.
- Observaciones e historial de la requisicion.
- Orden/metadatos generados por Compras, cuando existan.

Finanzas debe capturar:

- Proyecto.
- Fondo.
- Programa estrategico.
- Confirmacion de presupuesto disponible.
- Observacion financiera.

## Acciones de Finanzas

- `aprobar`: valida presupuesto y clasificacion financiera.
- `devolver_a_compras`: regresa a Compras con comentario obligatorio.
- `rechazar`: marca la requisicion como no procedente por motivo financiero.

## Reglas

- Solo usuarios con rol `finanzas` pueden operar la etapa financiera.
- Para aprobar son obligatorios `proyecto`, `fondo`, `programa_estrategico` y presupuesto disponible.
- Para devolver o rechazar el comentario es obligatorio.
- Toda accion debe registrar historial con usuario, fecha, accion, estado anterior, estado nuevo y comentario.
- Compras no debe poder finalizar una requisicion en `11` si no paso por aprobacion financiera.
- Si Finanzas devuelve a Compras, Compras puede corregir datos de compra/orden y reenviar a Finanzas.

## Estados propuestos

- `15`: `Finanzas`
- `16`: `Aprobada por Finanzas`
- `17`: `Rechazada por Finanzas`

Estos estados deben agregarse sin borrar ni cambiar los estados actuales.

## Transiciones propuestas

| Origen | Accion | Destino | Actor |
| --- | --- | --- | --- |
| `13 Compra` | Enviar a Finanzas | `15 Finanzas` | Compras Admin u Operador asignado |
| `15 Finanzas` | Aprobar | `16 Aprobada por Finanzas` | Finanzas |
| `15 Finanzas` | Devolver a Compras | `13 Compra` | Finanzas |
| `15 Finanzas` | Rechazar | `17 Rechazada por Finanzas` | Finanzas |
| `16 Aprobada por Finanzas` | Finalizar | `11 Finalizada` | Compras Admin u Operador asignado |

## Datos sugeridos

Tabla sugerida: `requisition_finance_review`

Campos minimos:

- `id`
- `requisition_id`
- `project`
- `fund`
- `strategic_program`
- `budget_available`
- `finance_observation`
- `reviewed_by`
- `reviewed_at`
- `created_at`
- `updated_at`

## Notificaciones

- Compras envia a Finanzas: notificar a usuarios `finanzas`.
- Finanzas aprueba: notificar a Compras.
- Finanzas devuelve: notificar a Compras con comentario.
- Finanzas rechaza: notificar a Compras, Coordinacion, Secretaria y solicitante.
- Compras finaliza despues de Finanzas: mantener notificaciones actuales de cierre.

## Criterios de aceptacion

- El flujo actual sigue funcionando en ramas donde no se active Finanzas.
- Una requisicion en `13` puede enviarse a `15`.
- Finanzas puede aprobar, devolver o rechazar desde `15`.
- No se puede aprobar sin proyecto, fondo, programa estrategico y presupuesto disponible.
- No se puede devolver o rechazar sin comentario.
- No se puede finalizar en `11` sin pasar por `16`.
- Todas las transiciones quedan en `requisition_status_history`.
- El frontend muestra una bandeja minima para Finanzas.

## Fuera de alcance inicial

- Reglas automaticas por monto.
- Multiples niveles de autorizacion financiera.
- Integracion con sistemas contables externos.
- Catalogos administrativos complejos para proyecto/fondo/programa.

