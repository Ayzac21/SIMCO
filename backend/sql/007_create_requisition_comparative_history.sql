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
