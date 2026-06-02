import { useEffect, useMemo, useState } from "react";
import { Edit3, KeyRound, Power, Search, Users } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "../../components/ConfirmModal";
import { API_BASE_URL } from "../../api/config";
import { getAuthHeaders } from "../../api/auth";

const emptyForm = {
  id: null,
  name: "",
  user_name: "",
  role: "finanzas_analista",
  email: "",
  password: "",
};

const financeRoleLabels = {
  finanzas: "Finanzas Admin",
  finanzas_admin: "Finanzas Admin",
  finanzas_analista: "Finanzas Analista",
  finanzas_lector: "Finanzas Lector",
};

export default function FinanzasPersonal() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ open: false, type: "", user: null });

  const editing = Boolean(form.id);

  const loadRows = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/finanzas/personal`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data?.message || "Error al cargar personal");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el personal de Finanzas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => Number(row.statuses_id) === 1).length,
      inactive: rows.filter((row) => Number(row.statuses_id) !== 1).length,
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && String(row.statuses_id) !== statusFilter) return false;
      if (!needle) return true;
      return [row.name, row.user_name, row.email]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle));
    });
  }, [rows, query, statusFilter]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const startEdit = (row) => {
    setForm({
      id: row.id,
      name: row.name || "",
      user_name: row.user_name || "",
      role: row.role === "finanzas" ? "finanzas_admin" : row.role || "finanzas_analista",
      email: row.email || "",
      password: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.user_name.trim()) {
      toast.error("Nombre y usuario son obligatorios");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        user_name: form.user_name.trim(),
        role: form.role,
        email: form.email.trim() || null,
      };
      if (!editing || form.password.trim()) payload.password = form.password.trim();
      const resp = await fetch(
        editing ? `${API_BASE_URL}/finanzas/personal/${form.id}` : `${API_BASE_URL}/finanzas/personal`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "No se pudo guardar");
      toast.success(editing ? "Usuario actualizado" : "Usuario creado");
      resetForm();
      await loadRows();
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const runConfirmAction = async () => {
    const user = confirmAction.user;
    if (!user) return;

    try {
      setSaving(true);
      if (confirmAction.type === "reset") {
        const password = window.prompt("Nueva contraseña para Finanzas:");
        if (!password) {
          setSaving(false);
          setConfirmAction({ open: false, type: "", user: null });
          return;
        }
        const resp = await fetch(`${API_BASE_URL}/finanzas/personal/${user.id}/reset-password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ password }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || "No se pudo restablecer");
        toast.success("Contraseña restablecida");
      } else {
        const nextStatus = confirmAction.type === "activate" ? 1 : 2;
        const resp = await fetch(`${API_BASE_URL}/finanzas/personal/${user.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ statuses_id: nextStatus }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || "No se pudo actualizar estatus");
        toast.success(nextStatus === 1 ? "Usuario activado" : "Usuario desactivado");
      }
      setConfirmAction({ open: false, type: "", user: null });
      await loadRows();
    } catch (error) {
      toast.error(error?.message || "No se pudo completar la acción");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 text-gray-900">
      <ConfirmModal
        open={confirmAction.open}
        title={
          confirmAction.type === "reset"
            ? "Restablecer contraseña"
            : confirmAction.type === "activate"
            ? "Activar usuario"
            : "Desactivar usuario"
        }
        headerText="Confirmar acción"
        description={`Se aplicará la acción al usuario ${confirmAction.user?.name || ""}.`}
        confirmText="Confirmar"
        loading={saving}
        variant={confirmAction.type === "deactivate" ? "danger" : "warning"}
        icon={confirmAction.type === "reset" ? KeyRound : Power}
        onCancel={() => {
          if (!saving) setConfirmAction({ open: false, type: "", user: null });
        }}
        onConfirm={runConfirmAction}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#8B1D35]/10 text-[#8B1D35]">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">SIMCO Finanzas</p>
            <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Personal de Finanzas</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
              Administra únicamente usuarios del perfil Finanzas. Estos usuarios no requieren URE.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-gray-400">Total</p>
              <p className="text-xl font-extrabold text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-emerald-600">Activos</p>
              <p className="text-xl font-extrabold text-emerald-700">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase text-gray-400">Inactivos</p>
              <p className="text-xl font-extrabold text-gray-700">{stats.inactive}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">
                  {editing ? "Editar usuario" : "Nuevo usuario"}
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-gray-900">Acceso a Finanzas</h3>
              </div>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase text-gray-600">
                Nombre completo
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-[#8B1D35]"
                  placeholder="Ej. Usuario Finanzas"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-gray-600">
                Usuario
                <input
                  value={form.user_name}
                  onChange={(event) => updateForm("user_name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-[#8B1D35]"
                  placeholder="Ej. finanzas"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-gray-600">
                Perfil
                <select
                  value={form.role}
                  onChange={(event) => updateForm("role", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-[#8B1D35]"
                >
                  <option value="finanzas_admin">Finanzas Admin</option>
                  <option value="finanzas_analista">Finanzas Analista</option>
                  <option value="finanzas_lector">Finanzas Lector</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase text-gray-600">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-[#8B1D35]"
                  placeholder="correo@dominio.com"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-gray-600">
                Contraseña
                <input
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case outline-none focus:border-[#8B1D35]"
                  placeholder={editing ? "Dejar vacío para no cambiar" : "Contraseña inicial"}
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-[#8B1D35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#74182c] disabled:opacity-60"
              >
                {saving ? "Guardando..." : editing ? "Actualizar usuario" : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900">Usuarios de Finanzas</h3>
              <p className="text-xs text-gray-500">Solo usuarios con rol Finanzas.</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#8B1D35] md:w-72"
                  placeholder="Buscar por nombre o usuario"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B1D35]"
              >
                <option value="all">Todos</option>
                <option value="1">Activos</option>
                <option value="2">Inactivos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">Cargando personal...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">Sin usuarios de Finanzas.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRows.map((row) => {
                const active = Number(row.statuses_id) === 1;
                return (
                  <div key={row.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_120px_220px] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-extrabold text-gray-900">{row.name}</p>
                        <span className="rounded-full border border-[#8B1D35]/20 bg-[#8B1D35]/5 px-2 py-0.5 text-[10px] font-bold text-[#8B1D35]">
                          {financeRoleLabels[row.role] || row.role || "Finanzas"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-100 text-gray-500"
                          }`}
                        >
                          {active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {row.user_name} · {row.email || "Sin email"} · Coordinación de Finanzas
                      </p>
                    </div>
                    <div className="text-xs font-semibold text-gray-500">ID #{row.id}</div>
                    <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ open: true, type: "reset", user: row })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      >
                        <KeyRound size={13} />
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmAction({ open: true, type: active ? "deactivate" : "activate", user: row })
                        }
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
                          active
                            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={active ? "Desactivar" : "Activar"}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
