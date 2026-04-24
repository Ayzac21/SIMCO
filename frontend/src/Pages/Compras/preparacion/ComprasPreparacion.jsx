import React, { useEffect, useState } from "react";
import { Search, RotateCw, Clock3, User, Briefcase, Eye } from "lucide-react";
import { toast } from "sonner";
import RequisitionModal from "../requisiciones/RequisitionModal";
import { API_BASE_URL } from "../../../api/config";
import { getCompactStatusLabel } from "../../../utils/statusDisplay";

const API = `${API_BASE_URL}/compras/preparacion`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function AppLoader({ label = "Cargando..." }) {
  return (
    <div className="flex-col gap-4 w-full flex items-center justify-center py-10">
      <div className="w-20 h-20 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
        <div className="w-16 h-16 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
      </div>
      <div className="text-xs text-gray-500 mt-2">{label}</div>
    </div>
  );
}

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

const roleLabel = (role) => {
  if (role === "head_office") return "URE";
  if (role === "coordinador") return "Coordinación";
  return "Otro";
};

export default function ComprasPreparacion() {
  const [rows, setRows] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    s7: 0,
    s8: 0,
    s9: 0,
    s10: 0,
    s11: 0,
    s12: 0,
    s13: 0,
    s14: 0,
  });

  const itemsPerPage = 10;

  const fetchDrafts = async ({ silent = false } = {}) => {
    const t0 = Date.now();
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        q: q.trim(),
        status: statusFilter,
      });

      const resp = await fetch(`${API}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error("No se pudo cargar la vista de preparación");

      const data = await resp.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
      setCounts({
        total: Number(data?.counts?.total || 0),
        s7: Number(data?.counts?.s7 || 0),
        s8: Number(data?.counts?.s8 || 0),
        s9: Number(data?.counts?.s9 || 0),
        s10: Number(data?.counts?.s10 || 0),
        s11: Number(data?.counts?.s11 || 0),
        s12: Number(data?.counts?.s12 || 0),
        s13: Number(data?.counts?.s13 || 0),
        s14: Number(data?.counts?.s14 || 0),
      });
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la vista de preparación");
    } finally {
      const elapsed = Date.now() - t0;
      const minMs = silent ? 1000 : 600;
      if (elapsed < minMs) await sleep(minMs - elapsed);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, currentPage, statusFilter]);

  const statusBadge = (statusId, statusName) => {
    const sid = Number(statusId || 0);
    if (sid === 7) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-amber-50 text-amber-700 border-amber-200" };
    if (sid === 8) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    if (sid === 9) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-violet-50 text-violet-700 border-violet-200" };
    if (sid === 10) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-rose-50 text-rose-700 border-rose-200" };
    if (sid === 11) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (sid === 12) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-orange-50 text-orange-700 border-orange-200" };
    if (sid === 13) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-blue-50 text-blue-700 border-blue-200" };
    if (sid === 14) return { text: getCompactStatusLabel(sid, statusName), cls: "bg-[#8B1D35]/10 text-[#8B1D35] border-[#8B1D35]/20" };
    return { text: getCompactStatusLabel(sid, statusName), cls: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  return (
    <div className="relative p-3 sm:p-5 lg:p-6 min-h-full bg-[#F3F4F6]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Total requisiciones</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{counts.total}</p>
          </div>
          <div className="p-2 bg-gray-100 rounded-lg text-gray-600 h-fit">
            <Clock3 size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">En Borrador</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{counts.s7}</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 h-fit">
            <User size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Validación Coord. + Sria.</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{counts.s8 + counts.s9}</p>
          </div>
          <div className="p-2 bg-[#8B1D35]/10 rounded-lg text-[#8B1D35] h-fit">
            <Briefcase size={20} />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "all"
                ? "bg-[#8B1D35] text-white border-[#8B1D35]"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Todas ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter("7"); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "7"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Borrador ({counts.s7})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter("8"); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "8"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Validación Coord. ({counts.s8})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter("9"); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "9"
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Validación Sria. ({counts.s9})
          </button>
        </div>
        <div className="relative w-full md:w-96">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por #, nombre, solicitante, unidad..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
          />
        </div>

        <button
          onClick={() => fetchDrafts({ silent: true })}
          disabled={loading || refreshing}
          className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${
            loading || refreshing
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-white text-[#8B1D35] border-[#8B1D35]/30 hover:bg-[#8B1D35]/10"
          }`}
        >
          <RotateCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-4 text-[11px] text-gray-500 font-medium">
        Última actualización: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString("es-MX") : "—"}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Vista anticipada de requisiciones</h3>
          <span className="text-xs text-gray-400 font-semibold">Mostrando: {rows.length}</span>
        </div>

        <div className="divide-y divide-gray-50">
          {loading ? (
            <AppLoader label="Cargando..." />
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No hay requisiciones para este filtro.</div>
          ) : (
            rows.map((req) => {
              const badge = statusBadge(req.statuses_id, req.nombre_estatus);
              return (
              <button
                key={req.id}
                type="button"
                onClick={() => setSelectedReq(req)}
                className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-700">#{req.id}</span>
                      <span className="font-bold text-gray-900 truncate">{req.request_name || "Sin nombre"}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">Solicitante: {req.solicitante || "—"}</p>
                      <p className="text-xs text-gray-500">Unidad: {req.nombre_unidad || "—"}</p>
                      <p className="text-xs text-gray-500">Coordinación: {req.coordinacion || "—"}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>
                      {String(badge.text || "").toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/20">
                      {roleLabel(req.created_by_role)}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {new Date(req.created_at).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <Eye size={12} /> Ver detalle
                    </span>
                  </div>
                </div>
              </button>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Página <b>{currentPage}</b> de <b>{Math.max(1, Math.ceil(total / itemsPerPage))}</b>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(Math.max(1, Math.ceil(total / itemsPerPage)), p + 1))}
              disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      {selectedReq && (
        <RequisitionModal
          req={selectedReq}
          onClose={() => setSelectedReq(null)}
          readOnly
        />
      )}
      {refreshing && !loading && (
        <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <AppLoader label="Actualizando..." />
        </div>
      )}
    </div>
  );
}
