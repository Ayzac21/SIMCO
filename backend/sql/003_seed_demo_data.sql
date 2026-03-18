-- SIMCO - Datos demo (opcional)
-- Importa después de 001 y 002.
-- NO usar en producción con datos reales.

SET NAMES utf8mb4;

-- Usuarios demo
-- password demo en texto: 123456
-- (el sistema la migra a bcrypt automáticamente al iniciar sesión)
INSERT INTO users (id, name, user_name, ure, statuses_id, email, password, role) VALUES
  (101, 'Jefe URE Demo', 'ure_demo', 'URE-01', 1, 'ure_demo@simco.local', '123456', 'head_office'),
  (102, 'Coordinador Demo', 'coor_demo', 'COOR-01', 1, 'coor_demo@simco.local', '123456', 'coordinador'),
  (103, 'Secretaría Demo', 'sec_demo', 'SEC-01', 1, 'sec_demo@simco.local', '123456', 'secretaria'),
  (104, 'Compras Admin Demo', 'compras_admin_demo', NULL, 1, 'compras_admin@simco.local', '123456', 'compras_admin'),
  (105, 'Compras Operador Demo', 'compras_op_demo', NULL, 1, 'compras_op@simco.local', '123456', 'compras_operador')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  user_name = VALUES(user_name),
  ure = VALUES(ure),
  statuses_id = VALUES(statuses_id),
  email = VALUES(email),
  role = VALUES(role);

-- Requisición demo (en revisión)
INSERT INTO requisition (
  id, folio, area_folio, notes, users_id, statuses_id, signatures, created_at, sent_on,
  categories_id, request_name, justification, observation, assigned_operator_id, order_type
) VALUES (
  1001, 'SIMCO-1001', 'AF-1001', 'AJUSTE_SECRETARIA: completar especificaciones técnicas',
  101, 14, '', NOW(), NOW(), 1, 'Compra de papelería demo',
  'Material de consumo mensual', 'Entrega en almacén central', 105, 'compra'
)
ON DUPLICATE KEY UPDATE
  request_name = VALUES(request_name),
  statuses_id = VALUES(statuses_id),
  notes = VALUES(notes),
  assigned_operator_id = VALUES(assigned_operator_id),
  order_type = VALUES(order_type);

INSERT INTO line_items (id, requisition_id, product_name, description, quantity, units_id) VALUES
  (2001, 1001, 'Hojas tamaño carta', 'Paquete de 500 hojas blancas', 20, 3),
  (2002, 1001, 'Pluma tinta azul', 'Caja con 12 piezas', 10, 2)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  quantity = VALUES(quantity),
  units_id = VALUES(units_id);

-- Proveedor demo
INSERT INTO provider (id, name, razon_social, email, rfc, statuses_id, address) VALUES
  (3001, 'Proveedor Demo SA', 'Proveedor Demo SA de CV', 'ventas@proveedor-demo.local', 'XAXX010101000', 5, 'Av. Demo #123')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  razon_social = VALUES(razon_social),
  email = VALUES(email),
  statuses_id = VALUES(statuses_id),
  address = VALUES(address);

INSERT IGNORE INTO provider_has_category (provider_id, categories_id) VALUES
  (3001, 1);

INSERT INTO phones (id, phone) VALUES
  (4001, '3333333333')
ON DUPLICATE KEY UPDATE phone = VALUES(phone);

INSERT IGNORE INTO provider_has_phones (provider_id, phones_id) VALUES
  (3001, 4001);

-- Cotización demo
INSERT INTO quotation_requests (requisition_id, provider_id, status, invited_at, responded_at, deadline_at) VALUES
  (1001, 3001, 'responded', NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY))
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  responded_at = VALUES(responded_at),
  deadline_at = VALUES(deadline_at);

INSERT INTO quotation_prices (
  requisition_id, line_item_id, provider_id, unit_price, offered_description, notes, is_winner, created_at
) VALUES
  (1001, 2001, 3001, 85.50, 'Hojas carta 75gr', '{"include_iva":true,"vat_percentage":16}', 1, NOW()),
  (1001, 2002, 3001, 120.00, 'Pluma azul punto fino', '{"include_iva":true,"vat_percentage":16}', 1, NOW())
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price),
  offered_description = VALUES(offered_description),
  notes = VALUES(notes),
  is_winner = VALUES(is_winner);

INSERT INTO quotation_selections (
  requisition_id, line_item_id, provider_id, selected_unit_price, selected_description, created_at, updated_at
) VALUES
  (1001, 2001, 3001, 85.50, 'Hojas carta 75gr', NOW(), NOW()),
  (1001, 2002, 3001, 120.00, 'Pluma azul punto fino', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  provider_id = VALUES(provider_id),
  selected_unit_price = VALUES(selected_unit_price),
  selected_description = VALUES(selected_description),
  updated_at = NOW();

-- Notificaciones demo
INSERT INTO notifications (
  recipient_user_id, actor_user_id, title, message, entity_type, entity_id, action_path, is_read, created_at
) VALUES
  (102, 103, 'Secretaría solicitó ajustes', 'La requisición #1001 requiere revisión de Coordinación.', 'requisition', 1001, '/coordinador/requisiciones?openReq=1001', 0, NOW()),
  (101, 102, 'Coordinación solicitó ajustes', 'La requisición #1001 requiere correcciones en URE.', 'requisition', 1001, '/unidad/requisiciones/editar/1001', 0, NOW());

