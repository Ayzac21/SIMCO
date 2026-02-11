import React, { useEffect, useMemo, useState } from "react";
import { Search, FileText, Building2, User, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import RequisitionModal from "../requisiciones/RequisitionModal";
import { API_BASE_URL } from "../../../api/config";

const API = `${API_BASE_URL}/compras/historial`;

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

function AppLoader({ label = "Cargando..." }) {
  return (
    <div className="flex-col gap-4 w-full flex items-center justify-center py-10">
      <div className="w-12 h-12 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
        <div className="w-8 h-8 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function ComprasHistorial() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all"); // all | 10 | 11
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [includeItems, setIncludeItems] = useState(false);

  const [selectedReq, setSelectedReq] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        q: q.trim(),
        status: statusFilter,
      });
      const res = await fetch(`${API}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Error al cargar historial");
      const data = await res.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, q]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const badge = (st) => {
    if (Number(st) === 11) return { text: "COMPRADO", cls: "bg-secundario/10 text-secundario border-secundario/20" };
    if (Number(st) === 10) return { text: "RECHAZADO", cls: "bg-red-50 text-red-600 border-red-200" };
    return { text: "OTRO", cls: "bg-gray-100 text-gray-600 border-gray-200" };
  };

  const list = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-6">
      {selectedReq && (
        <RequisitionModal
          req={selectedReq}
          onClose={() => setSelectedReq(null)}
          readOnly
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => { setStatusFilter("all"); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "all" ? "bg-[#8B1D35] text-white border-[#8B1D35]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => { setStatusFilter("11"); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "11" ? "bg-secundario text-white border-secundario" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Compradas
          </button>
          <button
            onClick={() => { setStatusFilter("10"); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold border ${
              statusFilter === "10" ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Rechazadas
          </button>
        </div>

        <div className="relative md:ml-auto w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por #, nombre, unidad..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeItems}
              onChange={(e) => setIncludeItems(e.target.checked)}
            />
            Incluir partidas
          </label>
          <button
            onClick={async () => {
              try {
                const params = new URLSearchParams({
                  q: q.trim(),
                  status: statusFilter,
                  include_items: includeItems ? "1" : "0",
                });
                const resp = await fetch(`${API}/report?${params.toString()}`, {
                  headers: getAuthHeaders(),
                });
                if (!resp.ok) throw new Error("No se pudo generar el PDF");
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
              } catch (e) {
                console.error(e);
                toast.error(e?.message || "No se pudo generar el PDF");
              }
            }}
            className="px-3 py-2 rounded-lg text-xs font-bold bg-[#8B1D35] text-white hover:bg-[#72182b]"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18} className="text-[#8B1D35]" />
            Historial de Compras
          </h3>
          <span className="text-xs text-gray-400 font-semibold">
            Mostrando: {list.length}
          </span>
        </div>

        {loading ? (
          <AppLoader label="Cargando historial..." />
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No hay requisiciones históricas.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((req) => {
              const b = badge(req.statuses_id);
              return (
                <button
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-700">#{req.id}</span>
                        <span className="font-bold text-gray-900 truncate">{req.request_name}</span>
                      </div>

                      <div className="mt-2 flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10 w-fit">
                          <Building2 size={10} />
                          <span className="truncate max-w-[360px]">{req.nombre_unidad || "Sin Unidad"}</span>
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold">
                          ↳ {req.coordinacion || "General"}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <User size={12} />
                          {req.solicitante || "Sin solicitante"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${b.cls}`}>
                        {b.text}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <CalendarDays size={12} />
                        {new Date(req.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      {Number(req.statuses_id) === 11 && (
                        <span className="text-[10px] text-[#8B1D35] font-semibold">
                          Orden disponible en detalle
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            Página <b>{page}</b> de <b>{totalPages}</b>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
