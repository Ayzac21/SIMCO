SQL base para SIMCO (esquema + datos de ejemplo)

Orden recomendado de importación:

1. `001_schema_base.sql`
2. `002_seed_catalogs.sql`
3. `003_seed_demo_data.sql` (opcional, solo para pruebas)
4. `005_create_status_history.sql` (historial de cambios de estatus)

Notas:

- Los scripts usan `CREATE TABLE IF NOT EXISTS` para no romper si ya tienes parte de la base.
- El seed usa `INSERT ... ON DUPLICATE KEY UPDATE` / `INSERT IGNORE` para ser idempotente.
- Si ya tienes datos productivos, NO importes `003_seed_demo_data.sql`.
- Estos scripts incluyen las tablas nuevas que hoy se estaban creando al arrancar:
  - `notifications`
  - `requisition_attachments`
  - `requisition_status_history`

Snapshot de tu base local actual

- También puedes generar un clon exacto de tu BD local (estructura + datos) con:
  - `cd backend && node scripts/export-sql-snapshot.mjs`
- Eso crea dos archivos con timestamp en esta misma carpeta:
  - `900_local_schema_<timestamp>.sql` (solo estructura real actual)
  - `901_local_full_<timestamp>.sql` (estructura + datos reales actuales)
