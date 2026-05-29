-- SIMCO - Catalogos administrables de Finanzas
-- Proyectos, fondos y programas estrategicos usados por el perfil Finanzas.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS finance_catalog_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  catalog_type ENUM('project', 'fund', 'program') NOT NULL,
  code VARCHAR(60) NULL,
  name VARCHAR(180) NOT NULL,
  fiscal_year INT NULL,
  budget_amount DECIMAL(14,2) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_catalog_type_name (catalog_type, name),
  INDEX idx_finance_catalog_type_active (catalog_type, is_active),
  INDEX idx_finance_catalog_code (catalog_type, code)
);
