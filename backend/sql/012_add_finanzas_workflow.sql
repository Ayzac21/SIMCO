-- SIMCO - Flujo de Finanzas
-- Agrega estados y tabla de revision financiera sin alterar el flujo existente.

SET NAMES utf8mb4;

SET @has_status_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'statuses'
    AND COLUMN_NAME = 'type'
);

SET @insert_finance_statuses = IF(
  @has_status_type > 0,
  "INSERT INTO statuses (id, type, name) VALUES
    (15, 'Requisitions', 'Finanzas'),
    (16, 'Requisitions', 'Aprobada por Finanzas'),
    (17, 'Requisitions', 'Rechazada por Finanzas')
   ON DUPLICATE KEY UPDATE type = VALUES(type), name = VALUES(name)",
  "INSERT INTO statuses (id, name) VALUES
    (15, 'Finanzas'),
    (16, 'Aprobada por Finanzas'),
    (17, 'Rechazada por Finanzas')
   ON DUPLICATE KEY UPDATE name = VALUES(name)"
);

PREPARE stmt_insert_finance_statuses FROM @insert_finance_statuses;
EXECUTE stmt_insert_finance_statuses;
DEALLOCATE PREPARE stmt_insert_finance_statuses;

CREATE TABLE IF NOT EXISTS requisition_finance_review (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  project VARCHAR(180) NULL,
  fund VARCHAR(180) NULL,
  strategic_program VARCHAR(180) NULL,
  budget_available TINYINT(1) NOT NULL DEFAULT 0,
  finance_observation TEXT NULL,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rfr_requisition (requisition_id),
  INDEX idx_rfr_reviewed_by (reviewed_by),
  CONSTRAINT fk_rfr_requisition
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE
);
