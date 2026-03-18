import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, Plus, Search, X, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  const [pageSize, setPageSize] = useState(10);
  const formCardRef = React.useRef(null);
  const nameInputRef = React.useRef(null);

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
  }, [q, pageSize]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return units;
    return units.filter((u) => String(u.name || "").toLowerCase().includes(t) || String(u.id).includes(t));
  }, [q, units]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setEditing(null);
    setName("");
  };

  const startEdit = (unit) => {
    setEditing(unit);
    setName(unit.name || "");
    setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 40);
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

      <div ref={formCardRef} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold text-gray-600 mb-1">
              {editing ? "Editar unidad" : "Nueva unidad"}
            </label>
            {editing && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                Editando unidad #{editing.id}: <span className="font-bold">{editing.name}</span>
              </div>
            )}
            <input
              ref={nameInputRef}
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
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar unidad..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-secundario/20"
            />
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            Mostrar
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
              className="px-2 py-1.5 border border-gray-300 rounded-md bg-white text-xs"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
            filas
          </label>
          <span className="ml-auto text-xs text-gray-400">
            {loading ? "Cargando..." : `${filtered.length} unidad(es)`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin unidades registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-left w-24">
                    ID
                  </th>
                  <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-left">
                    Unidad
                  </th>
                  <th className="px-4 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide text-right w-28">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-gray-100 hover:bg-gray-50/60 ${
                      Number(editing?.id) === Number(u.id) ? "bg-amber-50/80" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">#{u.id}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-gray-800">{u.name}</td>
                    <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(u)}
                    disabled={!isOwner}
                    className={`px-2.5 py-1.5 text-xs rounded-md border disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 ${
                      Number(editing?.id) === Number(u.id)
                        ? "border-amber-300 bg-amber-100 text-amber-800"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <Pencil size={12} />
                    {Number(editing?.id) === Number(u.id) ? "Editando" : "Editar"}
                  </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Mostrando {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageItems.length, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title="Página anterior"
            >
              <ChevronsLeft size={12} />
              Ant
            </button>

            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`min-w-8 px-2 py-1.5 text-xs rounded-md border ${
                  n === currentPage
                    ? "border-secundario bg-secundario text-white"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                {n}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
              title="Página siguiente"
            >
              Sig
              <ChevronsRight size={12} />
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
