-- SIMCO - Bootstrap servidor (estructura complementaria + catálogos base)
-- Uso recomendado:
-- 1) Importar 001_schema_base.sql
-- 2) Importar este archivo 008_bootstrap_server_schema_and_catalogs.sql
-- 3) Crear usuarios iniciales (ej. compras_admin)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- MIGRACIONES ESTRUCTURA (sin datos operativos)
-- =========================================================

-- 1) Campos fiscales congelados por selección
SET @db_name = DATABASE();

SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'quotation_selections'
    AND COLUMN_NAME = 'selected_vat_percentage'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE quotation_selections ADD COLUMN selected_vat_percentage DECIMAL(6,2) NULL AFTER selected_description',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'quotation_selections'
    AND COLUMN_NAME = 'selected_isr_percentage'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE quotation_selections ADD COLUMN selected_isr_percentage DECIMAL(6,2) NULL AFTER selected_vat_percentage',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- 2) Historial de estatus
CREATE TABLE IF NOT EXISTS requisition_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  from_status_id INT NULL,
  to_status_id INT NOT NULL,
  changed_by BIGINT NULL,
  change_note TEXT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rsh_req_changed (requisition_id, changed_at),
  INDEX idx_rsh_to_status (to_status_id),
  CONSTRAINT fk_rsh_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE
);

-- 3) Ajuste FK changed_by (BIGINT compatible con users.id)

SET @has_fk_changed_by = (
  SELECT COUNT(1)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition_status_history'
    AND CONSTRAINT_NAME = 'fk_rsh_changed_by'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql_drop_fk_changed_by = IF(
  @has_fk_changed_by > 0,
  'ALTER TABLE requisition_status_history DROP FOREIGN KEY fk_rsh_changed_by',
  'SELECT 1'
);
PREPARE stmt_drop_fk_changed_by FROM @sql_drop_fk_changed_by;
EXECUTE stmt_drop_fk_changed_by;
DEALLOCATE PREPARE stmt_drop_fk_changed_by;

ALTER TABLE requisition_status_history
  MODIFY COLUMN changed_by BIGINT NULL;

SET @has_fk_changed_by_after = (
  SELECT COUNT(1)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition_status_history'
    AND CONSTRAINT_NAME = 'fk_rsh_changed_by'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql_add_fk_changed_by = IF(
  @has_fk_changed_by_after = 0,
  'ALTER TABLE requisition_status_history ADD CONSTRAINT fk_rsh_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_add_fk_changed_by FROM @sql_add_fk_changed_by;
EXECUTE stmt_add_fk_changed_by;
DEALLOCATE PREPARE stmt_add_fk_changed_by;

-- 4) Historial de comparativos
CREATE TABLE IF NOT EXISTS requisition_comparative_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  generated_by INT UNSIGNED NULL,
  trigger_event VARCHAR(40) NOT NULL DEFAULT 'excel_download',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rch_req (requisition_id),
  INDEX idx_rch_created (created_at),
  UNIQUE KEY uq_rch_req_version (requisition_id, version_no)
);

-- 5) Historial de asignación
CREATE TABLE IF NOT EXISTS requisition_assignment_history (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id BIGINT NOT NULL,
  previous_operator_id BIGINT NULL,
  new_operator_id BIGINT NULL,
  changed_by BIGINT NULL,
  change_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_req_assign_hist_req (requisition_id),
  INDEX idx_req_assign_hist_created (created_at)
);

-- 6) Campos de bomberazo en requisition
SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition'
    AND COLUMN_NAME = 'is_bomberazo'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE requisition ADD COLUMN is_bomberazo TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition'
    AND COLUMN_NAME = 'bomberazo_reason'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE requisition ADD COLUMN bomberazo_reason TEXT NULL',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition'
    AND COLUMN_NAME = 'bomberazo_enabled_by'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE requisition ADD COLUMN bomberazo_enabled_by BIGINT NULL',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'requisition'
    AND COLUMN_NAME = 'bomberazo_enabled_at'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE requisition ADD COLUMN bomberazo_enabled_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- 7) Campos meta de orden (si faltan)
SET @col_exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'orden_compra_meta'
    AND COLUMN_NAME = 'oc_payment_mode'
);
SET @sql_add_col = IF(
  @col_exists = 0,
  "ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_mode VARCHAR(20) NOT NULL DEFAULT 'contado'",
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_payment_anticipo'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_anticipo TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_delivery_place'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_delivery_place VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_delivery_date'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_delivery_date DATE NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_payment_start_date'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_start_date DATE NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_payment_end_date'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_end_date DATE NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_payment_date'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_date DATE NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_installments_count'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_installments_count INT NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_advance_percentage'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_advance_percentage DECIMAL(6,2) NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_payment_compliance'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_payment_compliance TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_buyer_initials'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_buyer_initials VARCHAR(12) NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_buyer_user_id'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_buyer_user_id INT NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

SET @col_exists = (
  SELECT COUNT(1) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'orden_compra_meta' AND COLUMN_NAME = 'oc_requester_vobo_name'
);
SET @sql_add_col = IF(@col_exists = 0, 'ALTER TABLE orden_compra_meta ADD COLUMN oc_requester_vobo_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt_add_col FROM @sql_add_col; EXECUTE stmt_add_col; DEALLOCATE PREPARE stmt_add_col;

-- =========================================================
-- CATALOGOS BASE (equivalente a 002_seed_catalogs.sql)
-- =========================================================

INSERT INTO statuses (id, name) VALUES
  (1,  'Activo'),
  (2,  'Inactivo'),
  (3,  'Proveedor Activo'),
  (4,  'Proveedor Inactivo'),
  (5,  'Proveedor Verificado'),
  (6,  'Proveedor No Verificado'),
  (7,  'Borrador'),
  (8,  'Coordinación'),
  (9,  'Secretaría'),
  (10, 'Rechazada'),
  (11, 'Finalizada'),
  (12, 'Cotización'),
  (13, 'Compra'),
  (14, 'Revisión')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO categories (name) VALUES
  ('Papelería'),
  ('Cómputo'),
  ('Mantenimiento'),
  ('Laboratorio'),
  ('Servicios')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO units (name) VALUES
  ('PZA'),
  ('CAJA'),
  ('PAQ'),
  ('KIT'),
  ('SERVICIO')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO coordination (id, ure, name) VALUES
  (1, 'COOR-01', 'Coordinación General')
ON DUPLICATE KEY UPDATE ure = VALUES(ure), name = VALUES(name);

INSERT INTO secretary (id, ure, name, coordination_id) VALUES
  (1, 'SEC-01', 'Secretaría General', 1)
ON DUPLICATE KEY UPDATE
  ure = VALUES(ure),
  name = VALUES(name),
  coordination_id = VALUES(coordination_id);

INSERT INTO head_offices (id, ure, name, coordination_id) VALUES
  (1, 'URE-01', 'Jefatura URE 01', 1),
  (2, 'URE-02', 'Jefatura URE 02', 1)
ON DUPLICATE KEY UPDATE
  ure = VALUES(ure),
  name = VALUES(name),
  coordination_id = VALUES(coordination_id);

SET FOREIGN_KEY_CHECKS = 1;
