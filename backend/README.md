# Backend SIMCO

## Plantillas PDF (Órdenes)

Las órdenes de compra y de servicio **no se generan desde cero**: se llenan sobre plantillas PDF.

Por defecto usamos las que están en:

- `backend/templates/ORDEN_DE_COMPRA.pdf`
- `backend/templates/ORDEN_DE_SERVICIO.pdf`

Si en el servidor quieres usar otros archivos, define en tu `.env`:

```
ORDEN_COMPRA_TEMPLATE=./templates/ORDEN_DE_COMPRA.pdf
ORDEN_SERVICIO_TEMPLATE=./templates/ORDEN_DE_SERVICIO.pdf
```

Notas rápidas:

- Las rutas pueden ser absolutas o relativas a `backend/`.
- Si la ruta del `.env` no existe, se usa la plantilla del repo sin romper.

## Seguridad (JWT)

El backend ahora usa JWT para validar cada request.

En tu `.env` agrega un secreto seguro:

```
JWT_SECRET=tu_secreto_largo
```

`JWT_SECRET` es obligatorio. Si falta, el backend no inicia.

Opcionalmente puedes definir una contraseña por defecto para altas/resets administrativos:

```
DEFAULT_USER_PASSWORD=una_clave_temporal_segura
```

Si no defines `DEFAULT_USER_PASSWORD`, deberás enviar `password` explícitamente en los endpoints de alta/reset de usuarios.
