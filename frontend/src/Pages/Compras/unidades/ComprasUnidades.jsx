import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../api/config";
import { canManageUnits } from "./unitsAccess";

const API_UNITS = `${API_BASE_URL}/units`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  return {
    "Content-Type": "application/json",
    "x-user-id": String(user?.id || ""),
    "x-user-role": String(user?.role || ""),
    Authorization: token ? `Bearer ${token}` : "",
  };
};

export default function ComprasUnidades() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const isOwner = canManageUnits(user);

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const loadUnits = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_UNITS, { headers: getAuthHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();
      setUnits(Array.isArray(data) ? data : []);
    } catch {
      toast.error("No se pudieron cargar las unidades");
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOwner) return;
    loadUnits();
  }, [isOwner]);

  React.useEffect(() => {
    setPage(1);
  }, [q]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return units;
    return units.filter((u) => String(u.name || "").toLowerCase().includes(t) || String(u.id).includes(t));
  }, [q, units]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const resetForm = () => {
    setEditing(null);
    setName("");
  };

  const startEdit = (unit) => {
    setEditing(unit);
    setName(unit.name || "");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!isOwner) {
      toast.warning("Solo la cuenta responsable puede administrar unidades");
      return;
    }
    const clean = String(name || "").trim();
    if (!clean) {
      toast.error("Escribe el nombre de la unidad");
      return;
    }

    try {
      setSaving(true);
      const isEdit = Boolean(editing?.id);
      const res = await fetch(isEdit ? `${API_UNITS}/${editing.id}` : API_UNITS, {
        method: isEdit ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error al guardar");

      toast.success(isEdit ? "Unidad actualizada" : "Unidad creada");
      resetForm();
      await loadUnits();
    } catch (e2) {
      toast.error(e2?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-amber-800">Acceso restringido</h2>
          <p className="text-xs text-amber-700 mt-1">
            Solo la cuenta responsable del catálogo puede administrar unidades.
          </p>
          <button
            type="button"
            onClick={() => navigate("/compras/dashboard")}
            className="mt-3 px-3 py-2 rounded-lg text-xs font-bold border border-amber-300 bg-white hover:bg-amber-100"
          >
            Volver al dashboard
          </button>
        </div>
      )}

      {isOwner && (
        <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Catálogo de Unidades</h2>
            <p className="text-xs text-gray-500 mt-1">
              Administra unidades de medida usadas en requisiciones.
            </p>
          </div>
          <button
            onClick={loadUnits}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-secundario text-white hover:opacity-90"
          >
            Recargar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold text-gray-600 mb-1">
              {editing ? "Editar unidad" : "Nueva unidad"}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ejemplo: Caja, Litro, Metro, Paquete"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-secundario/20"
              disabled={!isOwner}
            />
          </div>
          <div className="md:col-span-4 flex items-end gap-2">
            <button
              type="submit"
              disabled={saving || !isOwner}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-secundario text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {editing ? <Save size={14} /> : <Plus size={14} />}
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar unidad"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <X size={14} />
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar unidad..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs outline-none"
            />
          </div>
          <span className="ml-auto text-xs text-gray-400">
            {loading ? "Cargando..." : `${filtered.length} unidad(es)`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin unidades registradas.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="text-xs text-gray-400 w-12">#{u.id}</div>
                <div className="text-sm font-semibold text-gray-800">{u.name}</div>
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() => startEdit(u)}
                    disabled={!isOwner}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    <Pencil size={12} />
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Mostrando {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageItems.length, filtered.length)} de {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-600 min-w-16 text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
