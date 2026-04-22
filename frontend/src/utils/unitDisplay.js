const URE_CODE_PATTERN = /^\d+(?:\.[0-9A-Za-z]+)+$/;

const clean = (value) => String(value || "").trim();

export const isLikelyUreCode = (value) => URE_CODE_PATTERN.test(clean(value));

export const getUserUnitLabel = (user, fallback = "Unidad Responsable") => {
  const displayName = clean(user?.ure_name);
  if (displayName) return displayName;

  const rawUre = clean(user?.ure);
  if (!rawUre) return fallback;
  if (isLikelyUreCode(rawUre)) return fallback;
  return rawUre;
};

export const getRequisitionUnitLabel = (req, fallback = "Unidad solicitante") => {
  const name = clean(req?.nombre_unidad);
  if (name) return name;

  const code = clean(req?.ure_solicitante);
  if (!code) return fallback;
  if (isLikelyUreCode(code)) return fallback;
  return code;
};
