export const STATUS_LABELS = {
  7: "Borrador",
  8: "Coordinación",
  9: "Secretaría",
  10: "Rechazada",
  11: "Finalizada",
  12: "Cotización",
  13: "Proceso de compra",
  14: "Revisión interna",
};

export const getStatusLabel = (statusId, fallback = "") => {
  const normalized = STATUS_LABELS[Number(statusId)];
  if (normalized) return normalized;
  const cleanFallback = String(fallback || "").trim();
  return cleanFallback || "Sin estatus";
};
