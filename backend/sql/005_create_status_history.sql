-- Historial de cambios de estatus para trazabilidad de requisiciones
CREATE TABLE IF NOT EXISTS requisition_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  from_status_id INT NULL,
  to_status_id INT NOT NULL,
  changed_by INT UNSIGNED NULL,
  change_note TEXT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rsh_req_changed (requisition_id, changed_at),
  INDEX idx_rsh_to_status (to_status_id),
  CONSTRAINT fk_rsh_req FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE,
  CONSTRAINT fk_rsh_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
