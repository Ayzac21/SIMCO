export const STATUS_LABELS = {
  7: "Borrador",
  8: "En validación de Coordinación",
  9: "En validación de Secretaría",
  10: "Cancelada",
  11: "Finalizada",
  12: "Cotizando",
  13: "Proceso administrativo de compra",
  14: "Cotizada (Revisión interna)",
  15: "En revisión de Finanzas",
  16: "Aprobada por Finanzas",
  17: "Rechazada por Finanzas",
};

export const STATUS_SHORT_LABELS = {
  7: "Borrador",
  8: "Valid. Coord.",
  9: "Valid. Sria.",
  10: "Cancelada",
  11: "Finalizada",
  12: "Cotizando",
  13: "Proc. compra",
  14: "Cotizada",
  15: "Finanzas",
  16: "Aprob. Finanzas",
  17: "Rech. Finanzas",
};

export const getStatusLabel = (statusId, fallback = "") => {
  const normalized = STATUS_LABELS[Number(statusId)];
  if (normalized) return normalized;
  const cleanFallback = String(fallback || "").trim();
  return cleanFallback || "Sin estatus";
};

export const getCompactStatusLabel = (statusId, fallback = "") => {
  const normalized = STATUS_SHORT_LABELS[Number(statusId)];
  if (normalized) return normalized;
  return getStatusLabel(statusId, fallback);
};
