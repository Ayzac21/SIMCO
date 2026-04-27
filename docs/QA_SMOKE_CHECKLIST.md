# QA Smoke Checklist (SIMCO)

## 1) Login y sesión
- Iniciar sesión con: `head_office`, `coordinador`, `secretaria`, `compras_admin`, `compras_operador`.
- Abrir una notificación y validar que no cierre sesión.
- Cerrar sesión e iniciar de nuevo en otro perfil.

## 2) Flujo de requisición
- URE crea requisición con:
  - Nombre de solicitud
  - Justificación y observaciones
  - 2 partidas (con y sin imagen)
  - Adjuntos de requisición
- Enviar a coordinación.
- Coordinación:
  - Abrir modal y validar que se ven productos.
  - Solicitar corrección.
- URE/Coordinación editar y reenviar.
- Secretaría aprobar y enviar a compras.

## 3) Compras (asignación y cotización)
- Compras admin asigna requisición a operador.
- Operador abre requisición asignada y captura cotización.
- Enviar a revisión interna.
- Compras admin revisa y selecciona por partida.

## 4) Proceso de compra / orden
- Abrir proceso de compra para requisición en estatus 13.
- Validar previsualización por proveedor.
- Descargar orden PDF y revisar:
  - `REQ:` debe ser ID de requisición (no IDs de partida).
  - Observaciones en 3 líneas (área / REQ / iniciales).
  - Lugar de entrega por default.
- Marcar finalizada (solo con campos obligatorios de proveedor completos).

## 5) PDF requisición con firmas
- Generar PDF `REQUISICIÓN DE ARTÍCULOS Y/O SERVICIOS`.
- Validar campo `ETIQUETA`:
  - Debe mostrar `Nombre de la Solicitud`.

## 6) Notificaciones
- Verificar notificación al cambiar estatus en cada salto:
  - Coordinación
  - Secretaría
  - Compras
  - Finalización de compra
- Validar que las notificaciones navegan a ruta válida por rol.

## 7) Historial / timeline
- Abrir timeline de requisición finalizada.
- Confirmar que muestra eventos de estatus.
- Confirmar que, si hubo reasignación, aparecen eventos de asignación.
