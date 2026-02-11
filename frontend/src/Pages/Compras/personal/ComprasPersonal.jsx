import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ConfirmModal from "../../../components/ConfirmModal";
import { API_BASE_URL } from "../../../api/config";

const API_CATALOG = `${API_BASE_URL}/catalogs/ures`;
const API_USERS = `${API_BASE_URL}/users`;
const DEFAULT_PASSWORD = "C0mpr@s2026";

const getAuthHeaders = () => {
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const token = localStorage.getItem("token");
  return {
    "x-user-id": String(user?.id || ""),
    "x-user-role": String(user?.role || ""),
    Authorization: token ? `Bearer ${token}` : "",
  };
};

export default function ComprasPersonal() {
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === "compras_admin";
  const navigate = useNavigate();

  const [ures, setUres] = useState([]);
  const [loadingUres, setLoadingUres] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState({ open: false, type: null, user: null });
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all | 1 | 2
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [userNameError, setUserNameError] = useState("");
  const [ureError, setUreError] = useState("");
  const formRef = useRef(null);
  const nameInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    user_name: "",
    role: "head_office",
    ure: "",
    email: "",
    password: DEFAULT_PASSWORD,
  });

  const selectedUre = useMemo(
    () => ures.find((u) => u.ure === form.ure),
    [ures, form.ure]
  );

  const isComprasRole = useMemo(() => {
    return ["compras_admin", "compras_operador", "compras_lector"].includes(form.role);
  }, [form.role]);

  const stats = useMemo(() => {
    const total = users.length;
    const activos = users.filter((u) => Number(u.statuses_id) === 1).length;
    const inactivos = users.filter((u) => Number(u.statuses_id) !== 1).length;
    return { total, activos, inactivos };
  }, [users]);

  const roleCategory = isComprasRole
    ? "compras"
    : form.role === "coordinador"
    ? "coordinador"
    : form.role === "secretaria"
    ? "secretaria"
    : "head_office";

  useEffect(() => {
    const load = async () => {
    try {
      setLoadingUres(true);
      const params = new URLSearchParams({ role: form.role });
      const res = await fetch(`${API_CATALOG}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setUres(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error(e);
        toast.error("Error al cargar UREs");
      } finally {
        setLoadingUres(false);
      }
    };
    load();
  }, [form.role]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(API_USERS, { headers: getAuthHeaders() });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      toast.warning("Acceso solo para compras admin");
      navigate("/compras/dashboard");
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const ql = q.trim().toLowerCase();
      if (ql) {
        const match =
          (u.name || "").toLowerCase().includes(ql) ||
          (u.user_name || "").toLowerCase().includes(ql);
        if (!match) return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && String(u.statuses_id) !== statusFilter) return false;
      return true;
    });
  }, [users, q, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedUsers = filteredUsers.slice(pageStart, pageEnd);
  const pageWindowStart = Math.max(1, safePage - 2);
  const pageWindowEnd = Math.min(totalPages, safePage + 2);
  const pageNumbers = Array.from(
    { length: pageWindowEnd - pageWindowStart + 1 },
    (_, i) => pageWindowStart + i
  );

  useEffect(() => {
    setPage(1);
  }, [q, roleFilter, statusFilter, pageSize]);

  const validate = () => {
    if (!form.name.trim()) {
      toast.error("Falta nombre");
      return false;
    }
    if (!form.user_name.trim()) {
      toast.error("Falta usuario");
      return false;
    }
    if (!isComprasRole && !form.ure) {
      toast.error("Selecciona URE");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!isAdmin) {
      toast.warning("Solo compras admin puede crear o editar usuarios");
      return;
    }
    if (!validate()) return;
    setUserNameError("");
    setUreError("");

    try {
      setSaving(true);
      const isEdit = Boolean(editing?.id);
      const passwordValue = isEdit ? (form.password || "").trim() : form.password || DEFAULT_PASSWORD;
      const payload = {
        name: form.name.trim(),
        user_name: form.user_name.trim(),
        role: form.role,
        ure: isComprasRole ? null : form.ure,
        email: form.email.trim() || null,
      };
      if (passwordValue) {
        payload.password = passwordValue;
      }
      const res = await fetch(isEdit ? `${API_USERS}/${editing.id}` : API_USERS, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data?.message) {
          if (data.message.toLowerCase().includes("ure")) {
            setUreError(data.message);
          } else {
            setUserNameError(data.message);
          }
          requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            nameInputRef.current?.focus();
          });
          return;
        }
        throw new Error(data?.message || "Error al crear usuario");
      }

      toast.success(isEdit ? "Usuario actualizado" : "Usuario creado");
      setForm({
        name: "",
        user_name: "",
        role: "head_office",
        ure: "",
        email: "",
        password: DEFAULT_PASSWORD,
      });
      setEditing(null);
      await loadUsers();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Error al crear usuario");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u) => {
    if (!isAdmin) {
      toast.warning("Solo compras admin puede editar usuarios");
      return;
    }
    setEditing(u);
    setUserNameError("");
    setUreError("");
    setForm({
      name: u.name || "",
      user_name: u.user_name || "",
      role: u.role || "head_office",
      ure: u.ure || "",
      email: u.email || "",
      password: "",
    });
    toast("Editando usuario...");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setUserNameError("");
    setUreError("");
    setForm({
      name: "",
      user_name: "",
      role: "head_office",
      ure: "",
      email: "",
      password: DEFAULT_PASSWORD,
    });
  };

  const doDeactivate = async (u) => {
    if (!isAdmin) {
      toast.warning("Solo compras admin puede desactivar usuarios");
      return;
    }
    const toastId = toast.loading("Procesando...");
    try {
      const res = await fetch(`${API_USERS}/${u.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ statuses_id: 2 }),
      });
      if (!res.ok) throw new Error();
      toast.success("Usuario desactivado", { id: toastId });
      await loadUsers();
    } catch {
      toast.error("Error al desactivar", { id: toastId });
    }
  };

  const doActivate = async (u) => {
    if (!isAdmin) {
      toast.warning("Solo compras admin puede activar usuarios");
      return;
    }
    const toastId = toast.loading("Procesando...");
    try {
      const res = await fetch(`${API_USERS}/${u.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ statuses_id: 1 }),
      });
      if (!res.ok) throw new Error();
      toast.success("Usuario activado", { id: toastId });
      await loadUsers();
    } catch {
      toast.error("Error al activar", { id: toastId });
    }
  };

  const doResetPassword = async (u) => {
    if (!isAdmin) {
      toast.warning("Solo compras admin puede resetear contraseñas");
      return;
    }
    const toastId = toast.loading("Procesando...");
    try {
      const res = await fetch(`${API_USERS}/${u.id}/reset-password`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success("Contraseña reseteada", { id: toastId });
    } catch {
      toast.error("Error al resetear", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmModal
        open={confirmAction.open}
        title={
          confirmAction.type === "reset"
            ? "Resetear contraseña"
            : confirmAction.type === "deactivate"
            ? "Desactivar usuario"
            : "Activar usuario"
        }
        headerText="Confirmar acción"
        description={
          confirmAction.type === "reset"
            ? `Se asignará la contraseña genérica a ${confirmAction.user?.name || ""}.`
            : confirmAction.type === "deactivate"
            ? `Se desactivará a ${confirmAction.user?.name || ""}.`
            : `Se activará a ${confirmAction.user?.name || ""}.`
        }
        confirmText={
          confirmAction.type === "reset"
            ? "Sí, resetear"
            : confirmAction.type === "deactivate"
            ? "Sí, desactivar"
            : "Sí, activar"
        }
        cancelText="Cancelar"
        onConfirm={() => {
          const u = confirmAction.user;
          const t = confirmAction.type;
          setConfirmAction({ open: false, type: null, user: null });
          if (!u) return;
          if (t === "reset") return doResetPassword(u);
          if (t === "deactivate") return doDeactivate(u);
          if (t === "activate") return doActivate(u);
        }}
        onCancel={() => setConfirmAction({ open: false, type: null, user: null })}
      />
      {isAdmin && (
      <div ref={formRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-1">
              {editing ? (
                <>
                  Editar <span className="text-red-600">usuario</span>
                </>
              ) : (
                <>
                  Registrar <span className="text-red-600">usuario</span>
                </>
              )}
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Completa los datos y selecciona la URE desde el catálogo.{" "}
              <span className="text-red-600 font-semibold">Obligatorio</span> para roles con URE.
            </p>
          </div>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-600">Nombre completo</label>
          <input
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            ref={nameInputRef}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-bold text-gray-600">Tipo de usuario</label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { key: "head_office", label: "Jefe de unidad" },
              { key: "coordinador", label: "Coordinador" },
              { key: "secretaria", label: "Secretaría" },
              { key: "compras", label: "Compras" },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  if (r.key === "compras") {
                    setField("role", "compras_admin");
                  } else {
                    setField("role", r.key);
                  }
                  setField("ure", "");
                }}
                className={`px-3 py-3 rounded-lg text-xs font-bold border transition ${
                  roleCategory === r.key
                    ? "bg-secundario text-white border-secundario"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {roleCategory === "compras" && (
            <div className="mt-3">
              <label className="text-[11px] font-bold text-gray-500">Perfil de Compras</label>
              <select
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
              >
                <option value="compras_admin">Compras Admin</option>
                <option value="compras_operador">Compras Operador</option>
                <option value="compras_lector">Compras Lector</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600">Usuario</label>
          <input
            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
              userNameError
                ? "border-red-300 focus:ring-red-200/50 focus:border-red-400"
                : "focus:ring-secundario/20 focus:border-secundario"
            }`}
            value={form.user_name}
            onChange={(e) => {
              setField("user_name", e.target.value);
              if (userNameError) setUserNameError("");
            }}
            placeholder="Ej. jperez"
          />
          {userNameError && (
            <p className="text-[11px] text-red-600 mt-1">{userNameError}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600">URE</label>
          <select
            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${
              ureError
                ? "border-red-300 focus:ring-red-200/50 focus:border-red-400"
                : "focus:ring-secundario/20 focus:border-secundario"
            }`}
            value={form.ure}
            onChange={(e) => {
              setField("ure", e.target.value);
              if (ureError) setUreError("");
            }}
            disabled={loadingUres || isComprasRole}
          >
            <option value="">
              {isComprasRole ? "No aplica" : loadingUres ? "Cargando..." : "Seleccionar..."}
            </option>
            {ures.map((u) => (
              <option key={u.ure} value={u.ure}>
                {u.ure} - {u.nombre_ure}
              </option>
            ))}
          </select>
          {!isComprasRole && selectedUre?.coordinacion && (
            <p className="text-[11px] text-gray-500 mt-1">
              Coordinación: <b>{selectedUre.coordinacion}</b>
            </p>
          )}
          {ureError && <p className="text-[11px] text-red-600 mt-1">{ureError}</p>}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600">Email (opcional)</label>
          <input
            type="email"
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="correo@dominio.com"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600">Contraseña</label>
          <input
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {editing ? "Dejar vacío para no cambiar." : "Contraseña genérica sugerida."}
          </p>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-6 py-2.5 rounded-lg bg-secundario text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Guardando..." : editing ? "Actualizar" : "Crear usuario"}
          </button>
        </div>
      </form>
      </div>
      )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Usuarios registrados</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Total: {stats.total} • Activos: {stats.activos} • Inactivos: {stats.inactivos}
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o usuario..."
              className="px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            >
              <option value="all">Todos los roles</option>
              <option value="head_office">Jefe de unidad</option>
              <option value="coordinador">Coordinador</option>
              <option value="secretaria">Secretaría</option>
              <option value="compras_admin">Compras Admin</option>
              <option value="compras_operador">Compras Operador</option>
              <option value="compras_lector">Compras Lector</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            >
              <option value="all">Todos</option>
              <option value="1">Activos</option>
              <option value="2">Inactivos</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-secundario/20 focus:border-secundario"
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>
        </div>
        {loadingUsers ? (
          <div className="text-xs text-gray-400">Cargando usuarios...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-xs text-gray-400">Sin usuarios</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-gray-500 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">URE</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {pagedUsers.map((u, idx) => (
                    <tr key={u.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        <div className="flex flex-col">
                          <span>{u.name}</span>
                          <span className="text-[10px] text-gray-400">ID #{u.id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{u.user_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                            u.role === "compras_admin"
                              ? "bg-secundario/15 text-secundario border-secundario/30"
                              : u.role === "compras_operador"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : u.role === "compras_lector"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : u.role === "coordinador"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : u.role === "secretaria"
                              ? "bg-pink-50 text-pink-700 border-pink-200"
                              : u.role === "head_office"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {u.role || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {Number(u.statuses_id) === 1 ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-secundario/10 text-secundario border border-secundario/20">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{u.ure || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{u.email || "—"}</td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEdit(u)}
                              className="px-3 py-1.5 text-[10px] font-bold rounded bg-secundario text-white hover:opacity-90"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setConfirmAction({ open: true, type: "reset", user: u })}
                              className="px-3 py-1.5 text-[10px] font-bold rounded bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                            >
                              Restablecer
                            </button>
                            {Number(u.statuses_id) === 1 ? (
                              <button
                                onClick={() => setConfirmAction({ open: true, type: "deactivate", user: u })}
                                className="px-3 py-1.5 text-[10px] font-bold rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              >
                                Desactivar
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmAction({ open: true, type: "activate", user: u })}
                                className="px-3 py-1.5 text-[10px] font-bold rounded bg-secundario/10 text-secundario border border-secundario/30 hover:bg-secundario/20"
                              >
                                Activar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingUsers && filteredUsers.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
            <div className="text-[11px] text-gray-500">
              Mostrando {pageStart + 1}-{Math.min(pageEnd, filteredUsers.length)} de{" "}
              {filteredUsers.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-[10px] font-bold rounded border border-gray-200 text-gray-700 bg-white disabled:opacity-50"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={
                      n === safePage
                        ? "px-2.5 py-1.5 text-[10px] font-bold rounded bg-secundario text-white"
                        : "px-2.5 py-1.5 text-[10px] font-bold rounded border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-[10px] font-bold rounded border border-gray-200 text-gray-700 bg-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
