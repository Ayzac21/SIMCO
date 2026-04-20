-- SIMCO - Esquema base
-- Importa este archivo primero.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS statuses (
  id INT NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS units (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS coordination (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ure VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL
);

CREATE TABLE IF NOT EXISTS secretary (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ure VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  coordination_id INT NULL,
  CONSTRAINT fk_secretary_coordination
    FOREIGN KEY (coordination_id) REFERENCES coordination(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS head_offices (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ure VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  coordination_id INT NULL,
  CONSTRAINT fk_head_offices_coordination
    FOREIGN KEY (coordination_id) REFERENCES coordination(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  user_name VARCHAR(120) NOT NULL UNIQUE,
  ure VARCHAR(50) NULL,
  statuses_id INT NOT NULL DEFAULT 1,
  email VARCHAR(190) NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, statuses_id),
  INDEX idx_users_ure (ure)
);

CREATE TABLE IF NOT EXISTS requisition (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(80) NULL,
  area_folio VARCHAR(80) NULL,
  notes TEXT NULL,
  users_id BIGINT NOT NULL,
  statuses_id INT NOT NULL DEFAULT 7,
  signatures TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_on DATETIME NULL,
  categories_id INT NOT NULL,
  request_name VARCHAR(255) NOT NULL,
  justification TEXT NULL,
  observation TEXT NULL,
  assigned_operator_id BIGINT NULL,
  quotation_closed_at DATETIME NULL,
  quotation_closed_by BIGINT NULL,
  quotation_close_note TEXT NULL,
  order_type VARCHAR(20) NOT NULL DEFAULT 'compra',
  INDEX idx_req_user (users_id),
  INDEX idx_req_status (statuses_id),
  INDEX idx_req_category (categories_id),
  INDEX idx_req_assigned_operator (assigned_operator_id),
  CONSTRAINT fk_req_user
    FOREIGN KEY (users_id) REFERENCES users(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_req_category
    FOREIGN KEY (categories_id) REFERENCES categories(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_req_assigned_operator
    FOREIGN KEY (assigned_operator_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_req_closed_by
    FOREIGN KEY (quotation_closed_by) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS line_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  product_name VARCHAR(255) NULL,
  description TEXT NULL,
  quantity DECIMAL(14,2) NOT NULL DEFAULT 0,
  units_id INT NULL,
  unit VARCHAR(80) NULL,
  estimated_price DECIMAL(14,2) NULL,
  image_original_name VARCHAR(255) NULL,
  image_mime_type VARCHAR(120) NULL,
  image_size_bytes INT NULL,
  image_file_path VARCHAR(500) NULL,
  INDEX idx_li_req (requisition_id),
  INDEX idx_li_unit (units_id),
  CONSTRAINT fk_li_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_li_unit
    FOREIGN KEY (units_id) REFERENCES units(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS provider (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  razon_social VARCHAR(220) NULL,
  email VARCHAR(190) NULL,
  rfc VARCHAR(20) NOT NULL UNIQUE,
  statuses_id INT NOT NULL DEFAULT 6,
  address VARCHAR(400) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_provider_status (statuses_id),
  INDEX idx_provider_name (name)
);

CREATE TABLE IF NOT EXISTS phones (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_has_phones (
  provider_id INT NOT NULL,
  phones_id INT NOT NULL,
  PRIMARY KEY (provider_id, phones_id),
  INDEX idx_php_phone (phones_id),
  CONSTRAINT fk_php_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_php_phone
    FOREIGN KEY (phones_id) REFERENCES phones(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_has_category (
  provider_id INT NOT NULL,
  categories_id INT NOT NULL,
  PRIMARY KEY (provider_id, categories_id),
  INDEX idx_phc_category (categories_id),
  CONSTRAINT fk_phc_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_phc_category
    FOREIGN KEY (categories_id) REFERENCES categories(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quotation_requests (
  requisition_id INT NOT NULL,
  provider_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  invited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  deadline_at DATETIME NULL,
  PRIMARY KEY (requisition_id, provider_id),
  INDEX idx_qr_status (status),
  CONSTRAINT fk_qr_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qr_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quotation_prices (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  line_item_id INT NOT NULL,
  provider_id INT NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  offered_description TEXT NULL,
  notes TEXT NULL,
  is_winner TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qp_req_item_provider (requisition_id, line_item_id, provider_id),
  INDEX idx_qp_req (requisition_id),
  INDEX idx_qp_provider (provider_id),
  CONSTRAINT fk_qp_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qp_item
    FOREIGN KEY (line_item_id) REFERENCES line_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qp_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quotation_selections (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  line_item_id INT NOT NULL,
  provider_id INT NOT NULL,
  selected_unit_price DECIMAL(14,2) NULL,
  selected_description TEXT NULL,
  selected_vat_percentage DECIMAL(6,2) NULL,
  selected_isr_percentage DECIMAL(6,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qs_req_item (requisition_id, line_item_id),
  INDEX idx_qs_provider (provider_id),
  CONSTRAINT fk_qs_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qs_item
    FOREIGN KEY (line_item_id) REFERENCES line_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qs_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS orden_compra_meta (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  provider_id INT NOT NULL,
  folio VARCHAR(80) NULL,
  oc_incluir_iva TINYINT(1) NOT NULL DEFAULT 0,
  oc_iva_porcentaje DECIMAL(6,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ocm_req_provider (requisition_id, provider_id),
  CONSTRAINT fk_ocm_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ocm_provider
    FOREIGN KEY (provider_id) REFERENCES provider(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL,
  actor_user_id BIGINT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(600) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT NULL,
  action_path VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_notif_recipient_created (recipient_user_id, created_at),
  INDEX idx_notif_recipient_read (recipient_user_id, is_read),
  CONSTRAINT fk_notif_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS requisition_attachments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requisition_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_req_att_req (requisition_id),
  CONSTRAINT fk_req_att_req
    FOREIGN KEY (requisition_id) REFERENCES requisition(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_req_att_user
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE RESTRICT
);

SET FOREIGN_KEY_CHECKS = 1;
