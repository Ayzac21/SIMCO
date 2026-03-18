-- SIMCO - Seed de catálogos
-- Importa después de 001_schema_base.sql

SET NAMES utf8mb4;

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
ON DUPLICATE KEY UPDATE
  ure = VALUES(ure),
  name = VALUES(name);

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

