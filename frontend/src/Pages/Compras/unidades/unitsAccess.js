const envOwnerIdRaw = Number(import.meta.env.VITE_UNITS_OWNER_ID || 0);
const OWNER_ID = Number.isInteger(envOwnerIdRaw) && envOwnerIdRaw > 0 ? envOwnerIdRaw : 0;
const OWNER_USER = String(import.meta.env.VITE_UNITS_OWNER_USER || "")
  .trim()
  .toLowerCase();

export function canManageUnits(user) {
  const role = String(user?.role || "");
  if (!role.startsWith("compras_")) return false;
  if (role === "compras_lector") return false;

  const id = Number(user?.id || 0);
  if (OWNER_ID > 0) return id === OWNER_ID;

  if (!OWNER_USER) return role === "compras_admin";

  const userName = String(user?.user_name || "").trim().toLowerCase();
  return Boolean(userName) && userName === OWNER_USER;
}
