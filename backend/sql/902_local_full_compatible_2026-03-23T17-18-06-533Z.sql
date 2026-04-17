-- SIMCO local full compatible snapshot (schema + data)
-- Generated: 2026-03-23T17:18:06.907Z
-- Source database: Compras
-- Compatible schema: 001 + 005

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for categories
-- ----------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for coordination
-- ----------------------------
DROP TABLE IF EXISTS `coordination`;
CREATE TABLE `coordination` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ure` varchar(50) NOT NULL,
  `name` varchar(180) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ure` (`ure`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for head_offices
-- ----------------------------
DROP TABLE IF EXISTS `head_offices`;
CREATE TABLE `head_offices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ure` varchar(50) NOT NULL,
  `name` varchar(180) NOT NULL,
  `coordination_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ure` (`ure`),
  KEY `fk_head_offices_coordination` (`coordination_id`),
  CONSTRAINT `fk_head_offices_coordination` FOREIGN KEY (`coordination_id`) REFERENCES `coordination` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=306 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for line_items
-- ----------------------------
DROP TABLE IF EXISTS `line_items`;
CREATE TABLE `line_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `description` text,
  `quantity` decimal(14,2) NOT NULL DEFAULT '0.00',
  `units_id` int DEFAULT NULL,
  `unit` varchar(80) DEFAULT NULL,
  `estimated_price` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_li_req` (`requisition_id`),
  KEY `idx_li_unit` (`units_id`),
  CONSTRAINT `fk_li_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_li_unit` FOREIGN KEY (`units_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for notifications
-- ----------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_user_id` bigint NOT NULL,
  `actor_user_id` bigint DEFAULT NULL,
  `title` varchar(180) NOT NULL,
  `message` varchar(600) NOT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `action_path` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_recipient_created` (`recipient_user_id`,`created_at`),
  KEY `idx_notif_recipient_read` (`recipient_user_id`,`is_read`),
  KEY `fk_notif_actor` (`actor_user_id`),
  CONSTRAINT `fk_notif_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notif_recipient` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for orden_compra_meta
-- ----------------------------
DROP TABLE IF EXISTS `orden_compra_meta`;
CREATE TABLE `orden_compra_meta` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `provider_id` int NOT NULL,
  `folio` varchar(80) DEFAULT NULL,
  `oc_incluir_iva` tinyint(1) NOT NULL DEFAULT '0',
  `oc_iva_porcentaje` decimal(6,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ocm_req_provider` (`requisition_id`,`provider_id`),
  KEY `fk_ocm_provider` (`provider_id`),
  CONSTRAINT `fk_ocm_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ocm_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for phones
-- ----------------------------
DROP TABLE IF EXISTS `phones`;
CREATE TABLE `phones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `phone` varchar(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for provider
-- ----------------------------
DROP TABLE IF EXISTS `provider`;
CREATE TABLE `provider` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `razon_social` varchar(220) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `rfc` varchar(20) NOT NULL,
  `statuses_id` int NOT NULL DEFAULT '6',
  `address` varchar(400) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rfc` (`rfc`),
  KEY `idx_provider_status` (`statuses_id`),
  KEY `idx_provider_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for provider_has_category
-- ----------------------------
DROP TABLE IF EXISTS `provider_has_category`;
CREATE TABLE `provider_has_category` (
  `provider_id` int NOT NULL,
  `categories_id` int NOT NULL,
  PRIMARY KEY (`provider_id`,`categories_id`),
  KEY `idx_phc_category` (`categories_id`),
  CONSTRAINT `fk_phc_category` FOREIGN KEY (`categories_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_phc_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for provider_has_phones
-- ----------------------------
DROP TABLE IF EXISTS `provider_has_phones`;
CREATE TABLE `provider_has_phones` (
  `provider_id` int NOT NULL,
  `phones_id` int NOT NULL,
  PRIMARY KEY (`provider_id`,`phones_id`),
  KEY `idx_php_phone` (`phones_id`),
  CONSTRAINT `fk_php_phone` FOREIGN KEY (`phones_id`) REFERENCES `phones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_php_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for quotation_prices
-- ----------------------------
DROP TABLE IF EXISTS `quotation_prices`;
CREATE TABLE `quotation_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `line_item_id` int NOT NULL,
  `provider_id` int NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `offered_description` text,
  `notes` text,
  `is_winner` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_qp_req_item_provider` (`requisition_id`,`line_item_id`,`provider_id`),
  KEY `idx_qp_req` (`requisition_id`),
  KEY `idx_qp_provider` (`provider_id`),
  KEY `fk_qp_item` (`line_item_id`),
  CONSTRAINT `fk_qp_item` FOREIGN KEY (`line_item_id`) REFERENCES `line_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qp_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qp_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=159 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for quotation_requests
-- ----------------------------
DROP TABLE IF EXISTS `quotation_requests`;
CREATE TABLE `quotation_requests` (
  `requisition_id` int NOT NULL,
  `provider_id` int NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'invited',
  `invited_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` datetime DEFAULT NULL,
  `deadline_at` datetime DEFAULT NULL,
  PRIMARY KEY (`requisition_id`,`provider_id`),
  KEY `idx_qr_status` (`status`),
  KEY `fk_qr_provider` (`provider_id`),
  CONSTRAINT `fk_qr_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qr_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for quotation_selections
-- ----------------------------
DROP TABLE IF EXISTS `quotation_selections`;
CREATE TABLE `quotation_selections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `line_item_id` int NOT NULL,
  `provider_id` int NOT NULL,
  `selected_unit_price` decimal(14,2) DEFAULT NULL,
  `selected_description` text,
  `selected_vat_percentage` decimal(6,2) DEFAULT NULL,
  `selected_isr_percentage` decimal(6,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_qs_req_item` (`requisition_id`,`line_item_id`),
  KEY `idx_qs_provider` (`provider_id`),
  KEY `fk_qs_item` (`line_item_id`),
  CONSTRAINT `fk_qs_item` FOREIGN KEY (`line_item_id`) REFERENCES `line_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_qs_provider` FOREIGN KEY (`provider_id`) REFERENCES `provider` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_qs_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for requisition
-- ----------------------------
DROP TABLE IF EXISTS `requisition`;
CREATE TABLE `requisition` (
  `id` int NOT NULL AUTO_INCREMENT,
  `folio` varchar(80) DEFAULT NULL,
  `area_folio` varchar(80) DEFAULT NULL,
  `notes` text,
  `users_id` bigint NOT NULL,
  `statuses_id` int NOT NULL DEFAULT '7',
  `signatures` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_on` datetime DEFAULT NULL,
  `categories_id` int NOT NULL,
  `request_name` varchar(255) NOT NULL,
  `justification` text,
  `observation` text,
  `assigned_operator_id` bigint DEFAULT NULL,
  `quotation_closed_at` datetime DEFAULT NULL,
  `quotation_closed_by` bigint DEFAULT NULL,
  `quotation_close_note` text,
  `order_type` varchar(20) NOT NULL DEFAULT 'compra',
  PRIMARY KEY (`id`),
  KEY `idx_req_user` (`users_id`),
  KEY `idx_req_status` (`statuses_id`),
  KEY `idx_req_category` (`categories_id`),
  KEY `idx_req_assigned_operator` (`assigned_operator_id`),
  KEY `fk_req_closed_by` (`quotation_closed_by`),
  CONSTRAINT `fk_req_assigned_operator` FOREIGN KEY (`assigned_operator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_req_category` FOREIGN KEY (`categories_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_req_closed_by` FOREIGN KEY (`quotation_closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_req_user` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for requisition_attachments
-- ----------------------------
DROP TABLE IF EXISTS `requisition_attachments`;
CREATE TABLE `requisition_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `size_bytes` int NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `uploaded_by` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_req_att_req` (`requisition_id`),
  KEY `fk_req_att_user` (`uploaded_by`),
  CONSTRAINT `fk_req_att_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_req_att_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for requisition_status_history
-- ----------------------------
DROP TABLE IF EXISTS `requisition_status_history`;
CREATE TABLE `requisition_status_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `requisition_id` int NOT NULL,
  `from_status_id` int DEFAULT NULL,
  `to_status_id` int NOT NULL,
  `changed_by` bigint DEFAULT NULL,
  `change_note` text,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rsh_req_changed` (`requisition_id`,`changed_at`),
  KEY `idx_rsh_to_status` (`to_status_id`),
  KEY `fk_rsh_changed_by` (`changed_by`),
  CONSTRAINT `fk_rsh_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rsh_req` FOREIGN KEY (`requisition_id`) REFERENCES `requisition` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for secretary
-- ----------------------------
DROP TABLE IF EXISTS `secretary`;
CREATE TABLE `secretary` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ure` varchar(50) NOT NULL,
  `name` varchar(180) NOT NULL,
  `coordination_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ure` (`ure`),
  KEY `fk_secretary_coordination` (`coordination_id`),
  CONSTRAINT `fk_secretary_coordination` FOREIGN KEY (`coordination_id`) REFERENCES `coordination` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for statuses
-- ----------------------------
DROP TABLE IF EXISTS `statuses`;
CREATE TABLE `statuses` (
  `id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for units
-- ----------------------------
DROP TABLE IF EXISTS `units`;
CREATE TABLE `units` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(180) NOT NULL,
  `user_name` varchar(120) NOT NULL,
  `ure` varchar(50) DEFAULT NULL,
  `statuses_id` int NOT NULL DEFAULT '1',
  `email` varchar(190) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_name` (`user_name`),
  KEY `idx_users_role_status` (`role`,`statuses_id`),
  KEY `idx_users_ure` (`ure`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Data for categories
-- ----------------------------
INSERT INTO `categories` (`id`, `name`) VALUES
(7, 'Equipo de Seguridad e Higiene'),
(5, 'Mantenimiento y Reparaciones'),
(4, 'Material de Cafetería y Consumo'),
(8, 'Material Didáctico y Académico'),
(6, 'Mobiliario y Equipamiento'),
(2, 'Papelería y Material de Oficina'),
(3, 'Productos de Limpieza y Sanitización'),
(10, 'Servicios Profesionales'),
(9, 'Servicios y Transportes'),
(1, 'Tecnología y Equipos de Cómputo');

-- ----------------------------
-- Data for coordination
-- ----------------------------
INSERT INTO `coordination` (`id`, `ure`, `name`) VALUES
(1, '3.1.2.2', 'COORDINACIÓN DE PLANEACIÓN'),
(2, '3.1.2.3.2.1', 'COORDINACION DE LA CARRERA DE ADMINISTRACION'),
(3, '3.1.2.3.2.2', 'COORDINACION DE LA CARRERA DE CONTADURIA'),
(4, '3.1.2.3.2.3', 'COORDINACION DE LA CARRERA DE DERECHO'),
(5, '3.1.2.3.2.7', 'COORDINACION DE LA CARRERA DE INGENIERIA AGROINDUSTRIAL'),
(6, '3.1.2.3.2.8', 'COORDINACION DE LA CARRERA EN SISTEMAS PECUARIOS'),
(7, '3.1.2.3.2.11', 'COORDINACION DE LA CARREA DE INGENIERIA EN COMPUTACION'),
(8, '3.1.2.3.2.15', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN ENFERMERIA'),
(9, '3.1.2.3.2.18', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN PSICOLOGIA'),
(10, '3.1.2.3.2.19', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN MEDICINA'),
(11, '3.1.2.3.2.20', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN CIRUJANO DENTISTA'),
(12, '3.1.2.3.2.21', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN MEDICINA VETERINARIA Y ZOOTECNIA'),
(13, '3.1.2.3.2.22', 'COORDINACION DE LA CARRERA DE LICENCIATURA EN NUTRICION'),
(14, '3.1.2.3.2.23', 'COORDINACION DE LA CARRERA DE NEGOCIOS INTERNACIONALES'),
(15, '3.1.2.a', 'COORDINACIÓN DE LA CARRERA DE QUÍMICO FARMACÉUTICO BIÓLOGO'),
(16, '3.1.2.4', 'COORDINACION DE INVESTIGACION'),
(17, '3.1.2.5', 'COORDINACION DE EXTENSION'),
(18, '3.1.2.b', 'COORDINACIÓN DE LA MAESTRÍA EN PROCESOS INNOVADORES EN EL APRENDIZAJE'),
(19, '3.1.2.c', 'COORDINACIÓN DE LA MAESTRÍA EN ADMINISTRACIÓN DE NEGOCIOS'),
(20, '3.1.2.d', 'COORDINACIÓN DE LA ESPECIALIDAD EN ENDODONCIA'),
(21, '3.1.2.e', 'COORDINACIÓN DE LA ESPECIALIDAD EN ODONTOPEDIATRÍA'),
(22, '3.1.2.f', 'COORDINACIÓN DE LA ESPECIALIDAD Y MAESTRÍA EN PRODUCCIÓN ANIMAL SUSTENTABLE'),
(23, '3.1.2.g', 'COORDINACIÓN DEL DOCTORADO EN BIOCIENCIAS'),
(24, '3.1.2.6', 'COORDINACION DE SERVICIOS ACADEMICOS'),
(25, '3.1.2.7', 'COORDINACION DE TECNOLOGIAS PARA EL APRENDIZAJE'),
(26, '3.1.3.2', 'COORDINACION DE CONTROL ESCOLAR'),
(27, '3.1.3.3', 'COORDINACION DE FINANZAS'),
(28, '3.1.3.4', 'COORDINACION DE PERSONAL'),
(29, '3.1.3.5', 'COORDINACION DE SERVICIOS GENERALES'),
(30, '3.1.1.2.2', 'DEPARTAMENTO DE ESTUDIOS JURIDICOS, SOCIALES Y DE LA CULTURA'),
(31, '3.1.5.3', 'DEPARTAMENTO DE ESTUDIOS ORGANIZACIONALES'),
(32, '3.1.4.2', 'DEPARAMENTO DE CIENCIAS DE LA SALUD'),
(33, '3.1.4.4', 'DEPARTAMENTO DE CLÍNICAS'),
(34, '3.1.1.4.2', 'DEPARTAMENTO DE CIENCIAS PECUARIAS Y AGRÍCOLAS'),
(35, '3.1.1.4.3', 'DEPARTAMENTO DE INGENIERIAS');

-- ----------------------------
-- Data for head_offices
-- ----------------------------
INSERT INTO `head_offices` (`id`, `ure`, `name`, `coordination_id`) VALUES
(245, '3.1.2.5.2', 'DIFUSION', 17),
(246, '3.1.2.5.3', 'SERVICIO SOCIAL', 17),
(247, '3.1.2.5.4', 'VINCULACION', 17),
(248, '3.1.2.5.a', 'DEPORTES', 17),
(249, '3.1.2.5.b', 'BOLSA DE TRABAJO', 17),
(250, '3.1.2.5.c', 'UNIDAD DE EGRESADOS', 17),
(251, '3.1.2.5.d', 'CULTURA', 17),
(252, '3.1.2.6.2', 'BECAS E INTERCAMBIO ACADEMICO', 24),
(253, '3.1.2.6.3', 'BIBLIOTECAS', 24),
(254, '3.1.2.6.a', 'AUTOACCESO', 24),
(255, '3.1.2.6.b', 'PROGRAMA INSTITUCIONAL DE TUTORÍAS', 24),
(256, '3.1.2.6.c', 'CENEVAL', 24),
(257, '3.1.2.7.2', 'UNIDAD DE MULTIMEDIA INSTRUCCIONAL', 25),
(258, '3.1.2.7.3', 'COMPUTO Y TELECOMUNICACIONES PARA EL APRENDIZAJE', 25),
(259, '3.1.3.2.2', 'INGRESO', 26),
(260, '3.1.3.2.3', 'CONTROL', 26),
(261, '3.1.3.2.4', 'ATENCION', 26),
(262, '3.1.3.3.2', 'CONTABILIDAD', 27),
(263, '3.1.3.3.3', 'PRESUPUESTO', 27),
(264, '3.1.3.3.4', 'NOMINA', 27),
(265, '3.1.3.3.a', 'FONDOS EXTERNOS', 27),
(266, '3.1.3.4.2', 'PERSONAL ACADEMICO', 28),
(267, '3.1.3.4.3', 'PERSONAL ADMINISTRATIVO', 28),
(268, '3.1.3.4.a', 'CONSULTORIO MÉDICO', 28),
(269, '3.1.3.5.2', 'SUMINISTRO', 29),
(270, '3.1.3.5.3', 'MANTENIMIENTO', 29),
(271, '3.1.3.5.a', 'UNIDAD DE PROTECCIÓN CIVIL UNIVERSITARIA', 29),
(272, '3.1.3.5.b', 'CONTRALORÍA', 29),
(273, '3.1.3.5.c', 'PATRIMONIO', 29),
(274, '3.1.3.5.d', 'SUPERVISIÓN Y CONTROL DE OBRAS', 30),
(275, '3.1.1.2.2.a', 'SALA DE JUICIOS ORALES', 30),
(276, '3.1.1.2.2.b', 'SALA DE MEDIACIÓN', 30),
(277, '3.1.5.3.a', 'CENTRO DE INVESTIGACIÓN EN INNOVACIÓN PARA LAS ORGANIZACIONES (CIIO)', 31),
(278, '3.1.5.3.b', 'LABORATORIO DE SERVICIOS ALIMENTICIOS', 31),
(279, '3.1.4.2.a', 'LABORATORIO DE PSICOLOGÍA', 32),
(280, '3.1.4.2.b', 'LABORATORIO DE MORFOLOGÍA', 32),
(281, '3.1.4.2.c', 'LABORATORIO DE MICROBIOLOGÍA', 32),
(282, '3.1.4.2.d', 'LABORATORIO DE BIOCIENCIAS', 32),
(283, '3.1.4.2.e', 'LABORATORIO DE DIETÉTICA', 32),
(284, '3.1.4.2.f', 'LABORATORIO DE EVALUACIÓN ESTADO NUTRICIONAL', 32),
(285, '3.1.4.2.g', 'LABORATORIO DE CIENCIAS FISIOLÓGICAS', 32),
(286, '3.1.4.4.a', 'CENTRO DE ATENCIÓN MÉDICA INTEGRAL (CAMI)', 33),
(287, '3.1.4.4.b', 'LABORATORIO DE CIRUGÍA EXPERIMENTAL', 33),
(288, '3.1.4.4.c', 'LABORATORIO DE ODONTOLOGÍA INTEGRAL', 33),
(289, '3.1.4.4.d', 'LABORATORIO DE ENFERMERÍA ', 33),
(290, '3.1.4.4.e', 'LABORATORIO DE PROSTODONCIA O PRÓTESIS DENTAL', 33),
(291, '3.1.4.4.f', 'INSTITUTO DE INVESTIGACIÓN EN CIENCIAS MÉDICAS', 33),
(292, '3.1.4.4.g', 'LABORATORIO BIOTECNOLÓGICO DE INVESTIGACIÓN Y DIAGNÓSTICO (LaBID)', 33),
(293, '3.1.4.4.h', 'LABORATORIO DE EXPERIMENTACIÓN ANIMAL (BIOTERIO)', 33),
(294, '3.1.1.4.2.a', 'LABORATORIO DE MORFOLOGÍA VETERINARIA', 34),
(295, '3.1.1.4.2.b', 'LABORATORIO DE MICROBIOLOGÍA DE ALIMENTOS', 34),
(296, '3.1.1.4.2.c', 'LABORATORIO DE TECNOLOGÍA DE ALIMENTOS', 34),
(297, '3.1.1.4.2.d', 'LABORATORIO DE PRODUCCIÓN VEGETAL HOLÍSTICA Y ECOTECNIAS SUSTENTABLES', 34),
(298, '3.1.1.4.2.e', 'LABORATORIO DE FORRAJES', 34),
(299, '3.1.1.4.2.f', 'LABORATORIO DE ANÁLISIS DEL AGUA', 34),
(300, '3.1.1.4.2.g', 'LABORATORIO DE GRANDES ESPECIES', 34),
(301, '3.1.4.3.1', 'LABORATORIO DE CLÍNICA VETERINARIA DE PEQUEÑAS ESPECIES', 35),
(302, '3.1.1.4.3.a', 'LABORATORIO DE FISICOQUÍMICOS', 35),
(303, '3.1.1.4.3.b', 'LABORATORIO DE SISTEMAS DIGITALES Y REDES', 35),
(304, '3.1.1.4.3.c', 'LABORATORIO DE SISTEMAS OPERATIVOS e loT', 35),
(305, '3.1.1.4.3.d', 'LABORATORIO DE NANOCATÁLISIS', 35);

-- ----------------------------
-- Data for line_items
-- ----------------------------
INSERT INTO `line_items` (`id`, `requisition_id`, `product_name`, `description`, `quantity`, `units_id`, `unit`, `estimated_price`) VALUES
(1, 1, 'ksvdnlkv', 'dlvsmdñlsv', '3.00', 1, NULL, NULL),
(2, 2, 'Plumas', 'Plumas para oficina, de colores azules y de color negra, 2 y 2 están bien :)', '4.00', 1, NULL, NULL),
(3, 2, 'Lapíz', 'Tener cajas de lapiz para lo que se use.', '3.00', 1, NULL, NULL),
(4, 3, 'adobe xd', 'Licencias de adobe para diseño...', '2.00', 1, NULL, NULL),
(5, 4, 'Lap', 'Lap para uds', '3.00', 1, NULL, NULL),
(6, 4, 'Teclado', 'Se necesita para las lap´s unos 3 :)', '3.00', 1, NULL, NULL),
(7, 5, 'hjdgsjhb', 'vadlkjnalsjkncñlajsnlk ', '3.00', 1, NULL, NULL),
(8, 6, 'Licencia ', '', '3.00', 1, NULL, NULL),
(9, 6, 'internet ', 'pagar el internet, me llamaron', '1.00', 1, NULL, NULL),
(10, 7, 'Licencia ', 'Licencias de adobe xd ', '4.00', 5, NULL, NULL),
(11, 8, 'mac pro', '', '2.00', 2, NULL, NULL),
(12, 14, 'HP Laptop 14”', '8GB RAM, 256GB SSD', '5.00', 1, NULL, NULL),
(13, 15, 'Mac air ', 'Mac de color negro, para mi porfas', '2.00', 2, NULL, NULL),
(14, 15, 'Teclado', 'Se requiere que las lap tenga un teclado estra para poder hacer mejores cosas ', '2.00', 2, NULL, NULL),
(15, 16, 'Silla ejecutiva', 'Color negro, base metálica', '5.00', 1, NULL, NULL),
(16, 17, 'Silla ejecutiva', 'Color negro, base metálica', '5.00', 1, NULL, NULL),
(17, 18, 'Lap ', 'que sean mac y de color blanco porfa ', '3.00', 2, NULL, NULL),
(18, 18, 'Teclado', 'Necesito tener mas teclado para la mac ', '3.00', 2, NULL, NULL),
(19, 19, 'Silla ejecutiva', 'Color negro, base metálica', '5.00', 1, NULL, NULL),
(20, 20, 'Teaclado', 'uno mas para que tengan todos', '4.00', 2, NULL, NULL),
(21, 20, 'Monitores', 'Para ver mas monitores en mi lugar', '2.00', 2, NULL, NULL),
(22, 21, 'lasokmc', 'kdvnjsdnvklj', '3.00', 2, NULL, NULL),
(23, 21, 'dskvjsdkj', 'sdkjvnkjsdn', '-1.00', 2, NULL, NULL),
(24, 22, 'Hojas carta ', 'solo eso se necesita', '3.00', 5, NULL, NULL),
(25, 23, 'Lap dell 2025 ', 'Dell de 2 tera, con memoria de 16 ram, 2 nucleos y algo mas de grafica', '2.00', 2, NULL, NULL),
(26, 24, 'asvlkan', 'dskuhvs', '3.00', 3, NULL, NULL),
(27, 25, 'Hojas de office', 'hojas tamaño carta para impresion de colores, mas rojas que verdes porfa', '3.00', 2, NULL, NULL),
(31, 25, 'Plumas', 'de color azul', '4.00', 2, NULL, NULL),
(33, 26, 'Objeto 1', 'Uno mas ', '2.00', 8, NULL, NULL),
(34, 26, 'Objeto 2', 'Unos mas ', '4.00', 8, NULL, NULL),
(35, 26, '', 'otro', '4.00', 2, NULL, NULL),
(36, 27, 'prueba 2', 'solo es para ver como saldra en la parte del coordinador', '2.00', 8, NULL, NULL),
(37, 28, 'Cafe uno', 'Cafe de grano para poder moler, que sea cafe y de cualqueir marca ', '5.00', 2, NULL, NULL),
(38, 29, 'Hojas blancas', 'Que sean tamaño carta, hojas blancas y son por paquete ', '3.00', 4, NULL, NULL),
(39, 30, 'Camioneta', 'Camioneta de carga para transportar los materiales que se compraran', '1.00', 1, NULL, NULL),
(40, 29, 'Carpetas', 'Paquete de carpetas', '4.00', 1, NULL, NULL),
(41, 28, 'Té', 'Cajas de té para la cocina ', '5.00', 2, NULL, NULL),
(42, 31, 'PC DELL, de CORE i5', 'Las clasificaciones son de las pc acordadas con la empresa, CORE i5, con RAM de 16, con teclados y ratones', '10.00', 2, NULL, NULL),
(43, 31, 'Monitores DELL', 'Son 10 monitores que van acorde a los PC, son DELL serie S', '10.00', 2, NULL, NULL),
(45, 29, 'Plumas', 'Caja de plumas de gel, de coló azul.', '2.00', 12, NULL, NULL),
(46, 32, 'Café', 'Cafe molido, para poner en la precoladora', '2.00', 3, NULL, NULL),
(47, 32, 'Vasos', 'Paquete de vasos para el café', '4.00', 1, NULL, NULL),
(48, 32, 'Azucar', 'Azucar para el café.', '2.00', 9, NULL, NULL),
(49, 32, 'Cuchara', 'Un paquete de cucharas de platico para poder poner para el cafe, solo se requiere un paquete', '2.00', 3, NULL, NULL);

-- ----------------------------
-- Data for notifications
-- ----------------------------
INSERT INTO `notifications` (`id`, `recipient_user_id`, `actor_user_id`, `title`, `message`, `entity_type`, `entity_id`, `action_path`, `is_read`, `created_at`, `read_at`) VALUES
(4, 39, 35, 'Nueva requisición en Secretaría', 'La requisición #29 fue autorizada por Coordinación y está lista para revisión.', 'requisition', 29, '/secretaria/recibidas', 0, '2026-03-09 13:01:17.000', NULL),
(10, 39, 35, 'Nueva requisición en Secretaría', 'La requisición #31 fue autorizada por Coordinación y está lista para revisión.', 'requisition', 31, '/secretaria/recibidas?openReq=31', 0, '2026-03-11 14:02:05.000', NULL),
(12, 41, 38, 'Nueva requisición en Compras', 'La requisición #31 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 31, '/compras/dashboard', 1, '2026-03-11 14:02:40.000', '2026-03-11 14:06:20.000'),
(13, 42, 38, 'Nueva requisición en Compras', 'La requisición #31 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 31, '/compras/dashboard', 0, '2026-03-11 14:02:40.000', NULL),
(15, 41, 40, 'Nueva requisición asignada', 'Se te asignó la requisición #31 - Equipos de laboratorio K-104.', 'requisition', 31, '/compras/dashboard', 1, '2026-03-11 14:04:25.000', '2026-03-11 14:06:22.000'),
(17, 41, 40, 'Selección aprobada por Compras Admin', 'La requisición #31 ya tiene selección completa y pasó a proceso de compra.', 'requisition', 31, '/compras/dashboard', 1, '2026-03-11 14:40:28.000', '2026-03-11 14:41:19.000'),
(21, 39, 35, 'Nueva requisición en Secretaría', 'La requisición #29 fue autorizada por Coordinación y está lista para revisión.', 'requisition', 29, '/secretaria/recibidas?openReq=29', 0, '2026-03-13 14:18:29.000', NULL),
(23, 41, 38, 'Nueva requisición en Compras', 'La requisición #29 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 29, '/compras/dashboard', 0, '2026-03-13 14:20:58.000', NULL),
(24, 42, 38, 'Nueva requisición en Compras', 'La requisición #29 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 29, '/compras/dashboard', 0, '2026-03-13 14:20:58.000', NULL),
(26, 33, 40, 'Requisición finalizada', 'La requisición #23 fue marcada como finalizada por Compras.', 'requisition', 23, '/unidad/mi-requisiciones?openReq=23', 1, '2026-03-17 12:49:17.000', '2026-03-17 13:30:05.000'),
(29, 39, 40, 'Compra finalizada', 'La requisición #23 fue finalizada por Compras.', 'requisition', 23, '/secretaria/recibidas?openReq=23', 0, '2026-03-17 12:49:17.000', NULL),
(30, 35, 34, 'Requisición en Coordinación', 'La requisición #32 fue enviada para revisión de Coordinación.', 'requisition', 32, '/coordinador/requisiciones?openReq=32', 1, '2026-03-18 11:03:09.000', '2026-03-18 11:05:27.000'),
(32, 39, 35, 'Nueva requisición en Secretaría', 'La requisición #32 fue autorizada por Coordinación y está lista para revisión.', 'requisition', 32, '/secretaria/recibidas?openReq=32', 0, '2026-03-18 11:06:38.000', NULL),
(33, 35, 38, 'Secretaría solicitó ajustes', 'La requisición #32 necesita revisión de Coordinación antes de volver a URE.', 'requisition', 32, '/coordinador/requisiciones?openReq=32', 1, '2026-03-18 11:12:34.000', '2026-03-18 11:55:15.000'),
(34, 34, 35, 'Coordinación solicitó ajustes', 'La requisición #32 requiere correcciones. Revisa los comentarios y reenvía.', 'requisition', 32, '/unidad/requisiciones/editar/32', 1, '2026-03-18 11:58:35.000', '2026-03-18 11:58:43.000'),
(35, 35, 34, 'Requisición en Coordinación', 'La requisición #32 fue enviada para revisión de Coordinación.', 'requisition', 32, '/coordinador/requisiciones?openReq=32', 1, '2026-03-18 11:59:10.000', '2026-03-18 11:59:32.000'),
(36, 34, 35, 'Requisición autorizada por Coordinación', 'La requisición #32 fue aprobada y enviada a Secretaría para su revisión.', 'requisition', 32, '/unidad/mi-requisiciones?openReq=32', 1, '2026-03-18 12:00:08.000', '2026-03-18 12:01:01.000'),
(38, 39, 35, 'Nueva requisición en Secretaría', 'La requisición #32 fue autorizada por Coordinación y está lista para revisión.', 'requisition', 32, '/secretaria/recibidas?openReq=32', 0, '2026-03-18 12:00:08.000', NULL),
(39, 40, 38, 'Nueva requisición en Compras', 'La requisición #32 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 32, '/compras/dashboard', 1, '2026-03-18 12:00:30.000', '2026-03-18 12:43:48.000'),
(40, 41, 38, 'Nueva requisición en Compras', 'La requisición #32 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 32, '/compras/dashboard', 0, '2026-03-18 12:00:30.000', NULL),
(41, 42, 38, 'Nueva requisición en Compras', 'La requisición #32 fue autorizada en Secretaría y está lista para cotización.', 'requisition', 32, '/compras/dashboard', 0, '2026-03-18 12:00:30.000', NULL),
(42, 35, 38, 'Secretaría autorizó requisición', 'La requisición #32 fue validada en Secretaría y enviada a Compras.', 'requisition', 32, '/coordinador/dashboard', 1, '2026-03-18 12:00:30.000', '2026-03-19 10:29:01.000'),
(43, 34, 38, 'Requisición autorizada por Secretaría', 'La requisición #32 pasó a Compras para cotización.', 'requisition', 32, '/unidad/mi-requisiciones?openReq=32', 1, '2026-03-18 12:00:30.000', '2026-03-18 12:01:04.000'),
(44, 34, 40, 'Requisición finalizada', 'La requisición #32 fue marcada como finalizada por Compras.', 'requisition', 32, '/unidad/mi-requisiciones?openReq=32', 1, '2026-03-18 15:38:35.000', '2026-03-18 15:39:59.000'),
(45, 35, 40, 'Requisición finalizada en Compras', 'La requisición #32 fue finalizada por Compras.', 'requisition', 32, '/coordinador/requisiciones?openReq=32', 1, '2026-03-18 15:38:35.000', '2026-03-19 10:28:58.000'),
(46, 38, 40, 'Compra finalizada', 'La requisición #32 fue finalizada por Compras.', 'requisition', 32, '/secretaria/recibidas?openReq=32', 0, '2026-03-18 15:38:35.000', NULL),
(47, 39, 40, 'Compra finalizada', 'La requisición #32 fue finalizada por Compras.', 'requisition', 32, '/secretaria/recibidas?openReq=32', 0, '2026-03-18 15:38:35.000', NULL),
(48, 33, 40, 'Requisición finalizada', 'La requisición #29 fue marcada como finalizada por Compras.', 'requisition', 29, '/unidad/mi-requisiciones?openReq=29', 0, '2026-03-19 10:37:56.000', NULL),
(49, 35, 40, 'Requisición finalizada en Compras', 'La requisición #29 fue finalizada por Compras.', 'requisition', 29, '/coordinador/requisiciones?openReq=29', 0, '2026-03-19 10:37:56.000', NULL),
(50, 38, 40, 'Compra finalizada', 'La requisición #29 fue finalizada por Compras.', 'requisition', 29, '/secretaria/recibidas?openReq=29', 0, '2026-03-19 10:37:56.000', NULL),
(51, 39, 40, 'Compra finalizada', 'La requisición #29 fue finalizada por Compras.', 'requisition', 29, '/secretaria/recibidas?openReq=29', 0, '2026-03-19 10:37:56.000', NULL);

-- ----------------------------
-- Data for orden_compra_meta
-- ----------------------------
INSERT INTO `orden_compra_meta` (`id`, `requisition_id`, `provider_id`, `folio`, `oc_incluir_iva`, `oc_iva_porcentaje`, `created_at`, `updated_at`) VALUES
(1, 22, 5, NULL, 0, NULL, '2026-02-10 13:47:41.000', '2026-02-10 13:47:41.000'),
(2, 23, 3, '2223', 1, '16.00', '2026-02-10 13:47:41.000', '2026-02-10 14:04:24.000'),
(3, 27, 2, NULL, 0, NULL, '2026-02-10 13:47:41.000', '2026-02-10 13:47:41.000'),
(4, 26, 1, '2220', 1, '16.00', '2026-02-10 13:47:41.000', '2026-02-10 13:47:41.000'),
(5, 26, 5, '2221', 1, '16.00', '2026-02-10 13:47:41.000', '2026-02-10 14:02:47.000'),
(15, 31, 2, '21211', 0, NULL, '2026-03-11 14:46:25.000', '2026-03-11 14:46:25.000'),
(16, 31, 5, '21212', 0, NULL, '2026-03-11 14:46:25.000', '2026-03-11 14:46:25.000'),
(17, 30, 1, '12123', 0, NULL, '2026-03-12 14:21:39.000', '2026-03-12 14:21:39.000'),
(18, 32, 3, '12225', 0, NULL, '2026-03-18 13:43:53.000', '2026-03-18 13:43:53.000'),
(19, 32, 2, '12226', 0, NULL, '2026-03-18 13:43:53.000', '2026-03-18 13:43:53.000'),
(20, 32, 1, '12227', 0, NULL, '2026-03-18 13:43:54.000', '2026-03-18 13:43:54.000'),
(21, 29, 5, '21002', 0, NULL, '2026-03-19 10:37:10.000', '2026-03-19 10:37:10.000'),
(22, 29, 1, '212150', 0, NULL, '2026-03-19 10:37:11.000', '2026-03-19 10:37:11.000'),
(23, 29, 2, '25113', 0, NULL, '2026-03-19 10:37:11.000', '2026-03-19 10:37:11.000');

-- ----------------------------
-- Data for provider
-- ----------------------------
INSERT INTO `provider` (`id`, `name`, `razon_social`, `email`, `rfc`, `statuses_id`, `address`, `created_at`) VALUES
(1, 'Office Depot Pro', NULL, 'ventas@officedepot.com', 'ODP951212AB1', 5, NULL, '2026-03-23 11:18:06.000'),
(2, 'Lumen Papelería', NULL, 'contacto@lumen.com.mx', 'LUM800101XYZ', 3, NULL, '2026-03-23 11:18:06.000'),
(3, 'Sistemas y Tecnologías SA', NULL, 'ventas@systec.com', 'SYT101010R44', 5, NULL, '2026-03-23 11:18:06.000'),
(4, 'Comercializadora del Centro', NULL, 'juan@comercial.com', 'CDC202020123', 3, 'ANDADOR IGNACIO ALDAMA 9, JARDINES DEL IXTEPETE, ZAPOPAN JALISCO', '2026-03-23 11:18:06.000'),
(5, 'Juanito Compras', NULL, 'correo@dominio.com', 'RFC123456789', 3, NULL, '2026-03-23 11:18:06.000');

-- ----------------------------
-- Data for provider_has_category
-- ----------------------------
INSERT INTO `provider_has_category` (`provider_id`, `categories_id`) VALUES
(1, 1),
(3, 1),
(1, 2),
(2, 2),
(4, 3),
(5, 7);

-- ----------------------------
-- Data for quotation_prices
-- ----------------------------
INSERT INTO `quotation_prices` (`id`, `requisition_id`, `line_item_id`, `provider_id`, `unit_price`, `offered_description`, `notes`, `is_winner`, `created_at`) VALUES
(1, 23, 25, 3, '12955.00', 'Dell de 2 tera, con memoria de 16 ram, 2 nucleos y algo mas de grafica\n', '', 0, '2026-02-03 12:45:33.000'),
(2, 23, 25, 1, '22521.00', 'esta no es una dell, solo tiene MAC y de 8. de ram', '', 0, '2026-02-03 12:45:33.000'),
(31, 22, 24, 5, '58.00', 'Solo eso se necesita y son en kit\n', '', 0, '2026-02-03 14:08:12.000'),
(36, 22, 24, 2, '265.00', 'este no tiene todo lo que se necesita', '', 0, '2026-02-03 14:29:11.000'),
(37, 26, 34, 5, '554.00', 'Si', '', 0, '2026-02-03 16:11:25.000'),
(38, 26, 33, 5, '55.00', 'Galon ya no', '', 0, '2026-02-03 16:11:25.000'),
(39, 26, 35, 5, '55.00', 'Hola', '', 0, '2026-02-03 16:11:25.000'),
(45, 26, 33, 1, '55.00', 'asjgvjahs', '', 0, '2026-02-03 16:15:28.000'),
(47, 26, 34, 1, '55.00', 'sdkjbvsdkjb', '', 0, '2026-02-03 16:15:28.000'),
(51, 27, 36, 2, '85.00', 'Es lo mismo', '', 0, '2026-02-10 12:23:30.000'),
(52, 27, 36, 4, '99.00', 'Es mejor producto', '', 0, '2026-02-10 12:23:30.000'),
(55, 27, 36, 5, '55.00', 'Este no es nada de lo que se', '', 0, '2026-02-10 12:24:09.000'),
(59, 30, 39, 4, '2000.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":true,\"isr_percentage\":10}', 0, '2026-03-10 16:11:09.000'),
(62, 30, 39, 1, '2500.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":true,\"isr_percentage\":9}', 0, '2026-03-10 16:15:59.000'),
(64, 31, 43, 5, '10000.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-11 14:07:15.000'),
(65, 31, 42, 5, '25250.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-11 14:07:15.000'),
(68, 31, 42, 1, '22590.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-11 14:11:33.000'),
(69, 31, 43, 1, '11200.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":true,\"isr_percentage\":1.25}', 0, '2026-03-11 14:11:33.000'),
(74, 31, 42, 2, '22000.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-11 14:14:27.000'),
(86, 30, 39, 2, '222000.00', '', '{\"include_iva\":false,\"vat_percentage\":null,\"include_isr\":true,\"isr_percentage\":10}', 0, '2026-03-11 16:39:21.000'),
(88, 29, 40, 5, '2000.00', '', '{\"include_iva\":false,\"vat_percentage\":null,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:34:05.000'),
(89, 29, 38, 5, '1000.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:34:05.000'),
(90, 29, 38, 1, '1000.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:34:05.000'),
(91, 29, 40, 1, '1900.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:34:05.000'),
(100, 29, 45, 1, '3500.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:36:44.000'),
(101, 29, 45, 2, '2600.00', '', '{\"include_iva\":false,\"vat_percentage\":null,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:36:44.000'),
(102, 29, 38, 2, '1300.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:36:44.000'),
(103, 29, 40, 2, '2100.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-17 12:36:44.000'),
(112, 32, 48, 1, '258.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:32:20.000'),
(113, 32, 46, 1, '252.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:32:20.000'),
(114, 32, 49, 1, '50.00', '', '{\"include_iva\":false,\"vat_percentage\":null,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:32:20.000'),
(115, 32, 47, 1, '320.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:32:20.000'),
(120, 32, 46, 2, '250.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:33:48.000'),
(121, 32, 47, 2, '300.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:33:48.000'),
(122, 32, 48, 2, '260.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:33:48.000'),
(123, 32, 49, 2, '60.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:33:48.000'),
(132, 32, 48, 3, '280.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:34:39.000'),
(133, 32, 49, 3, '80.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:34:39.000'),
(134, 32, 46, 3, '200.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:34:39.000'),
(135, 32, 47, 3, '350.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-18 13:34:39.000'),
(152, 29, 45, 3, '3100.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-19 10:32:51.000'),
(156, 29, 38, 3, '1200.00', '', '{\"include_iva\":false,\"vat_percentage\":null,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-19 10:32:51.000'),
(158, 29, 40, 3, '2300.00', '', '{\"include_iva\":true,\"vat_percentage\":16,\"include_isr\":false,\"isr_percentage\":null}', 0, '2026-03-19 10:32:51.000');

-- ----------------------------
-- Data for quotation_requests
-- ----------------------------
INSERT INTO `quotation_requests` (`requisition_id`, `provider_id`, `status`, `invited_at`, `responded_at`, `deadline_at`) VALUES
(22, 2, 'expired', '2026-02-03 14:28:44.000', NULL, NULL),
(22, 4, 'expired', '2026-02-03 15:54:32.000', NULL, NULL),
(22, 5, 'responded', '2026-02-03 14:28:44.000', NULL, NULL),
(23, 1, 'expired', '2026-02-03 13:29:52.000', NULL, NULL),
(23, 3, 'responded', '2026-02-03 13:29:52.000', NULL, NULL),
(26, 1, 'responded', '2026-02-03 16:11:47.000', '2026-02-03 16:15:28.000', NULL),
(26, 2, 'expired', '2026-02-03 16:11:47.000', NULL, NULL),
(26, 3, 'responded', '2026-02-03 16:11:47.000', NULL, NULL),
(26, 4, 'expired', '2026-02-03 16:11:39.000', NULL, NULL),
(26, 5, 'responded', '2026-02-03 16:11:01.000', '2026-02-03 16:11:25.000', NULL),
(27, 2, 'responded', '2026-02-10 12:17:27.000', '2026-02-10 12:23:30.000', NULL),
(27, 4, 'responded', '2026-02-10 12:17:27.000', '2026-02-10 12:23:30.000', NULL),
(27, 5, 'responded', '2026-02-10 12:17:27.000', '2026-02-10 12:24:09.000', NULL),
(29, 1, 'responded', '2026-03-17 12:34:05.000', '2026-03-17 12:34:05.000', NULL),
(29, 2, 'responded', '2026-03-17 12:34:05.000', '2026-03-17 12:36:44.000', NULL),
(29, 3, 'responded', '2026-03-17 12:34:05.000', '2026-03-19 10:32:51.000', NULL),
(29, 5, 'responded', '2026-03-17 12:34:05.000', '2026-03-17 12:34:05.000', NULL),
(30, 1, 'responded', '2026-03-10 16:15:34.000', '2026-03-10 16:15:59.000', NULL),
(30, 2, 'responded', '2026-03-10 16:15:34.000', '2026-03-11 16:39:21.000', NULL),
(30, 3, 'expired', '2026-03-10 16:15:34.000', NULL, NULL),
(30, 4, 'responded', '2026-03-10 16:11:09.000', '2026-03-10 16:11:09.000', NULL),
(30, 5, 'expired', '2026-03-10 16:15:34.000', NULL, NULL),
(31, 1, 'responded', '2026-03-11 14:07:15.000', '2026-03-11 14:11:33.000', NULL),
(31, 2, 'responded', '2026-03-11 14:07:15.000', '2026-03-11 14:14:27.000', NULL),
(31, 3, 'expired', '2026-03-11 14:07:15.000', NULL, NULL),
(31, 4, 'expired', '2026-03-11 14:07:15.000', NULL, NULL),
(31, 5, 'responded', '2026-03-11 14:07:15.000', '2026-03-11 14:07:15.000', NULL),
(32, 1, 'responded', '2026-03-18 12:49:51.000', '2026-03-18 13:32:20.000', NULL),
(32, 2, 'responded', '2026-03-18 12:49:51.000', '2026-03-18 13:33:48.000', NULL),
(32, 3, 'responded', '2026-03-18 12:49:51.000', '2026-03-18 13:34:39.000', NULL),
(32, 4, 'expired', '2026-03-18 12:49:51.000', NULL, NULL),
(32, 5, 'expired', '2026-03-18 12:49:51.000', NULL, NULL);

-- ----------------------------
-- Data for quotation_selections
-- ----------------------------
INSERT INTO `quotation_selections` (`id`, `requisition_id`, `line_item_id`, `provider_id`, `selected_unit_price`, `selected_description`, `selected_vat_percentage`, `selected_isr_percentage`, `created_at`, `updated_at`) VALUES
(1, 22, 24, 5, '58.00', 'Solo eso se necesita y son en kit\n', NULL, NULL, '2026-02-05 11:55:58.000', '2026-02-05 11:55:58.000'),
(2, 23, 25, 3, '12955.00', 'Dell de 2 tera, con memoria de 16 ram, 2 nucleos y algo mas de grafica\n', NULL, NULL, '2026-02-06 10:52:30.000', '2026-02-06 10:52:30.000'),
(3, 27, 36, 2, '85.00', 'Es lo mismo', NULL, NULL, '2026-02-10 12:31:41.000', '2026-02-10 12:31:41.000'),
(4, 26, 33, 1, '55.00', 'asjgvjahs', NULL, NULL, '2026-02-10 13:21:37.000', '2026-02-10 13:21:37.000'),
(5, 26, 34, 5, '554.00', 'Si', NULL, NULL, '2026-02-10 13:21:37.000', '2026-02-10 13:21:37.000'),
(6, 26, 35, 5, '55.00', 'Hola', NULL, NULL, '2026-02-10 13:21:37.000', '2026-02-10 13:21:37.000'),
(7, 31, 42, 2, '22000.00', '', NULL, NULL, '2026-03-11 14:40:28.000', '2026-03-11 14:40:28.000'),
(8, 31, 43, 5, '10000.00', '', NULL, NULL, '2026-03-11 14:40:28.000', '2026-03-11 14:40:28.000'),
(9, 30, 39, 1, '2500.00', '', NULL, NULL, '2026-03-12 14:15:58.000', '2026-03-12 14:15:58.000'),
(10, 32, 46, 3, '200.00', '', NULL, NULL, '2026-03-18 13:37:18.000', '2026-03-18 13:37:18.000'),
(11, 32, 47, 2, '300.00', '', NULL, NULL, '2026-03-18 13:37:18.000', '2026-03-18 13:37:18.000'),
(12, 32, 48, 1, '258.00', '', NULL, NULL, '2026-03-18 13:37:18.000', '2026-03-18 13:37:18.000'),
(13, 32, 49, 2, '60.00', '', NULL, NULL, '2026-03-18 13:37:18.000', '2026-03-18 13:37:18.000'),
(14, 29, 38, 5, '1000.00', '', NULL, NULL, '2026-03-19 10:36:06.000', '2026-03-19 10:36:06.000'),
(15, 29, 40, 1, '1900.00', '', NULL, NULL, '2026-03-19 10:36:06.000', '2026-03-19 10:36:06.000'),
(16, 29, 45, 2, '2600.00', '', NULL, NULL, '2026-03-19 10:36:06.000', '2026-03-19 10:36:06.000');

-- ----------------------------
-- Data for requisition
-- ----------------------------
INSERT INTO `requisition` (`id`, `folio`, `area_folio`, `notes`, `users_id`, `statuses_id`, `signatures`, `created_at`, `sent_on`, `categories_id`, `request_name`, `justification`, `observation`, `assigned_operator_id`, `quotation_closed_at`, `quotation_closed_by`, `quotation_close_note`, `order_type`) VALUES
(1, NULL, 'AF-7722', '', 33, 1, '', '2025-11-28 15:51:24.000', NULL, 4, 'Requisicion 1', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(2, NULL, 'AF-8739', '', 33, 1, '', '2025-12-08 10:14:38.000', NULL, 3, 'Requisicion 2', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(3, NULL, 'AF-1809', '', 33, 1, '', '2025-12-08 11:30:37.000', NULL, 10, 'Requisicion 3', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(4, NULL, 'AF-7246', '', 33, 1, '', '2025-12-08 12:05:00.000', NULL, 1, 'Requisicion 4', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(5, NULL, 'AF-6444', '', 33, 1, '', '2025-12-08 12:06:34.000', NULL, 1, 'Requisicion 5', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(6, NULL, 'AF-8617', '', 33, 1, '', '2025-12-08 12:15:59.000', NULL, 9, 'Requisicion 6', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(7, NULL, 'AF-7230', '', 33, 1, '', '2025-12-08 13:42:47.000', NULL, 9, 'Requisicion 7', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(8, NULL, 'AF-1579', '', 33, 1, '', '2025-12-09 10:04:57.000', NULL, 7, 'Requisicion 8', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(14, NULL, 'AF-3864', 'Urgent request to update equipment.', 33, 1, '', '2025-12-09 11:33:06.000', NULL, 2, 'Requisicion 14', NULL, NULL, NULL, NULL, NULL, NULL, 'compra'),
(15, NULL, 'AF-3510', '', 33, 1, '', '2025-12-09 11:35:04.000', NULL, 7, 'Requisicion 15', '', '', NULL, NULL, NULL, NULL, 'compra'),
(16, NULL, 'AF-4207', 'Solicitud desde postman', 33, 1, '', '2025-12-09 11:50:38.000', NULL, 7, 'Compra de mobiliario', 'Se necesita para equipar el aula nueva', 'Prioridad media', NULL, NULL, NULL, NULL, 'compra'),
(17, NULL, 'AF-8816', 'Solicitud desde postman', 33, 1, '', '2025-12-09 11:50:42.000', NULL, 7, 'Compra de mobiliario', 'Se necesita para equipar el aula nueva', 'Prioridad media', NULL, NULL, NULL, NULL, 'compra'),
(18, NULL, 'AF-6690', 'prueba 2', 33, 10, '', '2025-12-09 11:52:09.000', NULL, 1, 'Requisicion 18', '', '', NULL, NULL, NULL, NULL, 'compra'),
(19, NULL, 'AF-2978', 'Solicitud desde postman', 33, 1, '', '2025-12-09 11:54:48.000', NULL, 7, 'Compra de mobiliario', 'Se necesita para equipar el aula nueva', 'Prioridad media', NULL, NULL, NULL, NULL, 'compra'),
(20, NULL, 'AF-5447', '', 33, 1, '', '2025-12-09 12:01:00.000', NULL, 9, 'Otra veeee', 'Veamos que pasa', 'Solo es para veeeeer', NULL, NULL, NULL, NULL, 'compra'),
(21, NULL, 'AF-8808', '', 33, 1, '', '2025-12-11 11:11:56.000', NULL, 10, 'Nueva lap', 'no tengo ', 'necesito una', NULL, NULL, NULL, NULL, 'compra'),
(22, NULL, 'AF-5491', 'Autorizado por Coordinación', 33, 13, '', '2026-01-13 12:36:08.000', NULL, 7, 'hojass', 'para impresiones ', 'Autorizado Sec', NULL, NULL, NULL, NULL, 'compra'),
(23, NULL, 'AF-6655', NULL, 33, 11, '', '2026-01-13 13:25:33.000', NULL, 1, 'Laptop', 'nuevas lap para equipo', 'Autorizado por Secretaría', NULL, NULL, NULL, NULL, 'servicio'),
(24, NULL, 'AF-7392', 'uno mas', 33, 10, '', '2026-01-13 15:48:05.000', NULL, 7, 'dfbnkq', 'sñflkmv', 'ñsldvmñq', NULL, NULL, NULL, NULL, 'compra'),
(25, NULL, 'AF-7621', 'no funciono esta ', 33, 10, '', '2026-01-14 10:22:10.000', NULL, 2, 'Pedido de hojas para checar', 'hojas nuevas ', 'se necesita de colores', NULL, NULL, NULL, NULL, 'compra'),
(26, '2220', 'AF-8331', NULL, 33, 11, '', '2026-01-16 12:35:47.000', NULL, 9, 'PROYECTO DE PRUEBA ', 'Solo SON PRUEBAS DEL SISTEMAS ', 'Autorizado por Secretaría', NULL, NULL, NULL, NULL, 'compra'),
(27, NULL, 'AF-9504', NULL, 34, 11, '', '2026-01-22 15:24:53.000', NULL, 10, 'prueba 2', 'para ver que pasa', 'Autorizado por Secretaría', 41, '2026-02-10 12:30:02.000', NULL, NULL, 'compra'),
(28, NULL, 'AF-4104', NULL, 33, 8, '', '2026-02-05 16:12:54.000', NULL, 4, 'Cafe ', 'Para poder poner en la oficina ', 'Que sea de grano', NULL, NULL, NULL, NULL, 'compra'),
(29, NULL, 'AF-6505', NULL, 33, 11, '', '2026-02-05 16:50:01.000', '2026-03-13 14:18:03.000', 2, 'Paquetes dos ', 'Por falta de material ', 'Son para las impresiones y todas las copias ', NULL, '2026-03-19 10:33:03.000', NULL, NULL, 'compra'),
(30, NULL, 'CO-1699', NULL, 35, 11, '', '2026-02-09 10:54:04.000', NULL, 9, 'Transporte GDL', 'Vamos a ir todos a GDL.', 'Sera un viaje de dos días, iremos por uno cosas de trabajo.', NULL, '2026-03-12 11:04:53.000', NULL, NULL, 'compra'),
(31, NULL, 'AF-2894', 'Autorizado por Secretaría', 33, 13, '', '2026-03-11 11:53:16.000', NULL, 1, 'Equipos de laboratorio K-104', 'Son las remodelaciones de los equipos viejos, que están obsoletos', 'Son el proyecto que ya esta en marcha solo faltan algunos ', 41, '2026-03-11 14:15:45.000', NULL, NULL, 'compra'),
(32, NULL, 'AF-4353', NULL, 34, 11, '', '2026-03-18 11:01:21.000', '2026-03-18 11:03:09.000', 4, 'Café café', 'Se necesita para el evento de 19 de Marzo, sera para poder poner en la recepción de los invitados.', 'Se requiere uno paquetes de café para el evento, no es necesario alguna marca.', NULL, '2026-03-18 13:35:30.000', NULL, NULL, 'compra');

-- ----------------------------
-- Data for requisition_attachments
-- ----------------------------
INSERT INTO `requisition_attachments` (`id`, `requisition_id`, `original_name`, `stored_name`, `mime_type`, `size_bytes`, `file_path`, `uploaded_by`, `created_at`) VALUES
(1, 31, 'Captura de Pantalla 2026-03-11 a la(s) 11.53.06.png', 'req-1773251596236-823940.png', 'image/png', 104354, '/Users/umi/Documents/Software/SIMCO/backend/uploads/requisiciones/req-1773251596236-823940.png', 33, '2026-03-11 11:53:16.000'),
(2, 32, 'maqueta-marca-bolsa-cafe-papel-kraft_439185-10002.webp', 'req-1773853281298-241675.webp', 'image/webp', 15230, '/Users/umi/Documents/Software/SIMCO/backend/uploads/requisiciones/req-1773853281298-241675.webp', 34, '2026-03-18 11:01:21.000');

-- ----------------------------
-- Data for requisition_status_history
-- ----------------------------
INSERT INTO `requisition_status_history` (`id`, `requisition_id`, `from_status_id`, `to_status_id`, `changed_by`, `change_note`, `changed_at`) VALUES
(1, 30, 12, 14, 40, 'Enviado a revisión interna de compras', '2026-03-12 11:05:01.000'),
(2, 30, 14, 13, 40, 'Selección final completa en cuadro comparativo', '2026-03-12 14:15:58.000'),
(3, 30, 13, 11, 40, NULL, '2026-03-13 13:21:27.000'),
(4, 29, 8, 7, 35, 'AJUSTE_COORDINACION: Cambia algo solo para ver las fechas y ver si se mueven ...', '2026-03-13 13:28:41.000'),
(5, 29, 7, 8, 33, 'Envío de borrador', '2026-03-13 14:18:03.000'),
(6, 29, 8, 9, 35, 'Autorizado por Coordinación', '2026-03-13 14:18:29.000'),
(7, 29, 9, 12, 38, 'Autorizado por Secretaría', '2026-03-13 14:20:58.000'),
(8, 23, 13, 11, 40, NULL, '2026-03-17 12:49:17.000'),
(9, 32, NULL, 7, 34, 'Creación de requisición en borrador', '2026-03-18 11:01:21.000'),
(10, 32, 7, 8, 34, 'Envío de borrador', '2026-03-18 11:03:09.000'),
(11, 32, 8, 9, 35, 'Autorizado por Coordinación', '2026-03-18 11:06:38.000'),
(12, 32, 9, 8, 38, 'AJUSTE_SECRETARIA: Cambia el nombre de las cucharas, esas no se ocupan asi \n', '2026-03-18 11:12:34.000'),
(13, 32, 8, 7, 35, 'AJUSTE_COORDINACION: Cambio de las cucharas para que este bien ', '2026-03-18 11:58:35.000'),
(14, 32, 7, 8, 34, 'Envío de borrador', '2026-03-18 11:59:10.000'),
(15, 32, 8, 9, 35, 'Autorizado por Coordinación', '2026-03-18 12:00:08.000'),
(16, 32, 9, 12, 38, 'Autorizado por Secretaría', '2026-03-18 12:00:30.000'),
(17, 32, 12, 14, 40, 'Enviado a revisión interna de compras', '2026-03-18 13:35:36.000'),
(18, 32, 14, 13, 40, 'Selección final completa en cuadro comparativo', '2026-03-18 13:37:18.000'),
(19, 32, 13, 11, 40, NULL, '2026-03-18 15:38:35.000'),
(20, 29, 12, 14, 40, 'Enviado a revisión interna de compras', '2026-03-19 10:33:19.000'),
(21, 29, 14, 13, 40, 'Selección final completa en cuadro comparativo', '2026-03-19 10:36:06.000'),
(22, 29, 13, 11, 40, NULL, '2026-03-19 10:37:56.000');

-- ----------------------------
-- Data for secretary
-- ----------------------------
INSERT INTO `secretary` (`id`, `ure`, `name`, `coordination_id`) VALUES
(1, '3.1.2', 'SECRETARÍA ACADÉMICA', 1),
(2, '3.1.3', 'SECRETARÍA ADMINISTRATIVA', 26),
(3, '3.1.1.2', 'DIVISION DE CIENCIAS SOCIALES Y DE LA CULTURA', 30),
(4, '3.1.1.4', 'DIVISION DE CIENCIAS AGROPECUARIAS E INGENIERIAS', 34),
(5, '3.1.1.3', 'DIVISION DE CIENCIAS BIOMEDICAS', 32);

-- ----------------------------
-- Data for statuses
-- ----------------------------
INSERT INTO `statuses` (`id`, `name`) VALUES
(1, 'Activo'),
(2, 'Inactivo'),
(3, 'Activo'),
(4, 'Inactivo'),
(5, 'Verificado'),
(6, 'No verificado'),
(7, 'En borrador'),
(8, 'En coordinación'),
(9, 'En secretaria'),
(10, 'Rechazado'),
(11, 'Comprado'),
(12, 'En cotización'),
(13, 'En proceso de compra'),
(14, 'En revisión');

-- ----------------------------
-- Data for units
-- ----------------------------
INSERT INTO `units` (`id`, `name`) VALUES
(3, 'Bolsa'),
(12, 'Caja'),
(8, 'Galón'),
(4, 'Juego'),
(9, 'Kilogramo (kg)'),
(5, 'Kit'),
(6, 'Litro (L)'),
(7, 'Mililitro (ml)'),
(2, 'Pieza'),
(10, 'Tonelada (ton)'),
(1, 'Unidades');

-- ----------------------------
-- Data for users
-- ----------------------------
INSERT INTO `users` (`id`, `name`, `user_name`, `ure`, `statuses_id`, `email`, `password`, `role`, `created_at`) VALUES
(32, 'MARQUEZ ROMERO JORGE LUIS', '2959698', '3.1.2.7.2', 2, NULL, 'Aa@1', 'head_office', '2026-03-23 11:18:06.000'),
(33, 'CARLOS ISAAC LOPEZ ROMERO', '2971193', '3.1.2.7.2', 1, NULL, '$2a$10$2ORSZ6oP2ehG8iMRXXPA7./vSf89gZxRw1okyVHX8Wez7myC7wR52', 'head_office', '2026-03-23 11:18:06.000'),
(34, 'NAVARRO DÍAZ EDUARDO', '2952838', '3.1.2.7.3', 1, NULL, '$2a$10$U7dStwfcr8tJclnnrXQ5d.4UYPMd.KZ1Y9AOHryTa8vk0CspAB3a.', 'head_office', '2026-03-23 11:18:06.000'),
(35, 'DAVALOS GARCIA SERGIO ROBERTO', '2120631', '3.1.2.7', 1, NULL, '$2a$10$BYIRxODwCSmfjNYdxnmvqOzFXyRu1FcwkaG9.EYDSsrSjQDShWJOy', 'coordinador', '2026-03-23 11:18:06.000'),
(36, 'GUZMÁN SÁNCHEZ ERÉNDIDA MARISOL', '2224984', '3.1.2.6.3', 1, NULL, 'Aa@1', 'head_office', '2026-03-23 11:18:06.000'),
(37, 'GARCÍA PÉREZ JORGE FRANCISCO', '2805677', '3.1.2.6', 1, NULL, 'Aa@1', 'head_office', '2026-03-23 11:18:06.000'),
(38, 'YAMAGUCHI LLANES VÍCTOR KATSUMI', '2639599', '3.1.2', 1, NULL, '$2a$10$5IXd6VxSplKG9NUEk1ath.epS/un133Hm82BR7NSPZiG.pwihh9mm', 'secretaria', '2026-03-23 11:18:06.000'),
(39, 'FALCÓN LÓPEZ FERNANDO', '2639598', '3.1.3', 1, NULL, 'C0mpr@s2026', 'secretaria', '2026-03-23 11:18:06.000'),
(40, 'Compras', 'compras', NULL, 1, NULL, '$2a$10$7vMYlYFcRhARNBMtNFD9VuRCtMme2QdoUKe9tbD9SqSRVW0sOa3by', 'compras_admin', '2026-03-23 11:18:06.000'),
(41, 'Juan Rulfo', '001', NULL, 1, NULL, '$2a$10$Nw.aQI0LlzY30oiI4SrjMOtPPifrLR/8um/TOc63ObhvGVKAwQ3ty', 'compras_operador', '2026-03-23 11:18:06.000'),
(42, 'Isaac Lopez', '002', NULL, 1, NULL, '$2a$10$9u.n2kv21gAcBGMTmIrgR.VPcBiHkqezXI0.ADpx/yWA0uwJ6vrDu', 'compras_lector', '2026-03-23 11:18:06.000');

SET FOREIGN_KEY_CHECKS = 1;
