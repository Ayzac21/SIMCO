-- SIMCO - Alinear modelo hacia coordination.secretary_id
-- Objetivo:
-- 1) Asegurar columna coordination.secretary_id
-- 2) Poblarla desde secretary.coordination_id (si existe) o por coincidencia de URE
-- 3) Mantener compatibilidad (NO elimina secretary.coordination_id por defecto)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SET @db_name = DATABASE();

-- ---------------------------------------------------------
-- 1) Asegurar columna coordination.secretary_id
-- ---------------------------------------------------------
SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'coordination'
    AND COLUMN_NAME = 'secretary_id'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE coordination ADD COLUMN secretary_id INT NULL',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- Índice para secretary_id
SET @idx_exists = (
  SELECT COUNT(1)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'coordination'
    AND INDEX_NAME = 'idx_coord_secretary'
);
SET @sql_add_idx = IF(
  @idx_exists = 0,
  'ALTER TABLE coordination ADD INDEX idx_coord_secretary (secretary_id)',
  'SELECT 1'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

-- FK coordination.secretary_id -> secretary.id
SET @fk_exists = (
  SELECT COUNT(1)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db_name
    AND TABLE_NAME = 'coordination'
    AND CONSTRAINT_NAME = 'fk_coord_secretary'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_add_fk = IF(
  @fk_exists = 0,
  'ALTER TABLE coordination ADD CONSTRAINT fk_coord_secretary FOREIGN KEY (secretary_id) REFERENCES secretary(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;

-- ---------------------------------------------------------
-- 2) Migrar relación existente secretary -> coordination
-- ---------------------------------------------------------

-- 2a) Si existe secretary.coordination_id, usarla primero
SET @sec_has_coord_col = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'secretary'
    AND COLUMN_NAME = 'coordination_id'
);
SET @sql_sync_from_sec = IF(
  @sec_has_coord_col > 0,
  "UPDATE coordination c
   JOIN secretary s ON s.coordination_id = c.id
   SET c.secretary_id = s.id",
  'SELECT 1'
);
PREPARE stmt_sync_from_sec FROM @sql_sync_from_sec;
EXECUTE stmt_sync_from_sec;
DEALLOCATE PREPARE stmt_sync_from_sec;

-- 2b) Completar faltantes por mejor coincidencia de URE (prefijo más largo)
UPDATE coordination c
LEFT JOIN secretary s
  ON s.id = (
    SELECT s2.id
    FROM secretary s2
    WHERE TRIM(UPPER(c.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
    ORDER BY LENGTH(TRIM(s2.ure)) DESC
    LIMIT 1
  )
SET c.secretary_id = COALESCE(c.secretary_id, s.id)
WHERE c.secretary_id IS NULL;

-- ---------------------------------------------------------
-- 3) Opcional: eliminar secretary.coordination_id
-- ---------------------------------------------------------
-- ADVERTENCIA:
-- No se elimina por defecto para no romper compatibilidad con código existente.
-- Si más adelante confirmas que TODO el backend usa coordination.secretary_id,
-- puedes descomentar este bloque.
--
-- SET @sec_has_coord_col = (
--   SELECT COUNT(1)
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = @db_name
--     AND TABLE_NAME = 'secretary'
--     AND COLUMN_NAME = 'coordination_id'
-- );
--
-- -- si hay FK en secretary.coordination_id, quitarla antes
-- SET @fk_sec_coord = (
--   SELECT CONSTRAINT_NAME
--   FROM information_schema.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = @db_name
--     AND TABLE_NAME = 'secretary'
--     AND COLUMN_NAME = 'coordination_id'
--     AND REFERENCED_TABLE_NAME = 'coordination'
--   LIMIT 1
-- );
--
-- SET @sql_drop_fk_sec = IF(
--   @fk_sec_coord IS NOT NULL,
--   CONCAT('ALTER TABLE secretary DROP FOREIGN KEY ', @fk_sec_coord),
--   'SELECT 1'
-- );
-- PREPARE stmt_drop_fk_sec FROM @sql_drop_fk_sec;
-- EXECUTE stmt_drop_fk_sec;
-- DEALLOCATE PREPARE stmt_drop_fk_sec;
--
-- SET @sql_drop_col_sec = IF(
--   @sec_has_coord_col > 0,
--   'ALTER TABLE secretary DROP COLUMN coordination_id',
--   'SELECT 1'
-- );
-- PREPARE stmt_drop_col_sec FROM @sql_drop_col_sec;
-- EXECUTE stmt_drop_col_sec;
-- DEALLOCATE PREPARE stmt_drop_col_sec;

SET FOREIGN_KEY_CHECKS = 1;
