-- Compatibilidad: ajustar requisition_status_history.changed_by a BIGINT
-- para que coincida con users.id (BIGINT) y evitar errores de FK incompatibles.

CREATE TABLE IF NOT EXISTS requisition_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  from_status_id INT NULL,
  to_status_id INT NOT NULL,
  changed_by BIGINT NULL,
  change_note TEXT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rsh_req_changed (requisition_id, changed_at),
  INDEX idx_rsh_to_status (to_status_id)
);

SET @db_name = DATABASE();

-- Quitar FK previa si existe (tipo incompatible en algunos entornos)
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

-- Ajustar tipo de changed_by
ALTER TABLE requisition_status_history
  MODIFY COLUMN changed_by BIGINT NULL;

-- Re-crear FK compatible
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
