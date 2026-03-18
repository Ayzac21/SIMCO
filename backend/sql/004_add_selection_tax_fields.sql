-- Agrega porcentajes fiscales congelados a la selección final por partida
-- para mantener consistencia entre cuadro comparativo, proceso de compra y PDF.

ALTER TABLE quotation_selections
  ADD COLUMN IF NOT EXISTS selected_vat_percentage DECIMAL(6,2) NULL AFTER selected_description,
  ADD COLUMN IF NOT EXISTS selected_isr_percentage DECIMAL(6,2) NULL AFTER selected_vat_percentage;

