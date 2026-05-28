import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../api/config";
import { getAuthHeaders } from "../../api/auth";

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

const getAgeDays = (row) => {
  const time = new Date(row?.sent_on || row?.created_at).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
};

const ageLabel = (days) => {
  if (days <= 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
};

export default function FinanzasRecibidas() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadRows = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/finanzas/recibidas`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data?.message || "Error al cargar requisiciones");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "No se pudieron cargar las requisiciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.id, row.folio, row.area_folio, row.request_name, row.solicitante, row.solicitante_ure]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle))
    );
  }, [rows, query]);

  const totalVisible = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
    [rows]
  );

  const priorityRows = useMemo(() => rows.filter((row) => getAgeDays(row) >= 3), [rows]);
  const newestRow = rows[0] || null;

  return (
    <section className="text-gray-900">
      <div className="mb-5 overflow-hidden rounded-2xl border border-[#8B1D35]/10 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#8B1D35]/10 text-[#8B1D35]">
                <Banknote size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">SIMCO Finanzas</p>
                <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Bandeja de revisión presupuestal</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
                  Aquí llegan las requisiciones que Compras ya preparó. Finanzas revisa presupuesto y captura
                  proyecto, fondo y programa estratégico antes de que Compras pueda cerrar la orden.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#8B1D35]/10 bg-[#8B1D35]/[0.04] p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">Qué se debe hacer</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#8B1D35] shadow-sm">
                  1
                </span>
                <p className="text-gray-700">Abrir una requisición recibida.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#8B1D35] shadow-sm">
                  2
                </span>
                <p className="text-gray-700">Revisar artículos, proveedor seleccionado y monto.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#8B1D35] shadow-sm">
                  3
                </span>
                <p className="text-gray-700">Aprobar, devolver a Compras o rechazar con observación.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">En revisión</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900">{rows.length}</p>
            </div>
            <div className="h-fit rounded-lg bg-[#8B1D35]/10 p-2 text-[#8B1D35]">
              <ClipboardCheck size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#8B1D35]/20 bg-[#fff8f8] p-5 shadow-sm">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Monto por validar</p>
              <p className="mt-1 text-3xl font-extrabold text-[#8B1D35]">{money(totalVisible)}</p>
            </div>
            <div className="h-fit rounded-lg bg-white p-2 text-[#8B1D35]">
              <Banknote size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm ring-1 ring-red-50">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-400">Prioridad</p>
              <p className="mt-1 text-3xl font-extrabold text-red-600">{priorityRows.length}</p>
              <p className="mt-1 text-[10px] text-gray-400">+3 días en Finanzas</p>
            </div>
            <div className="h-fit rounded-lg bg-red-50 p-2 text-red-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Siguiente acción</p>
              <p className="mt-1 text-lg font-extrabold text-gray-900">
                {rows.length ? "Revisar pendiente" : "Esperar envío"}
              </p>
              <p className="mt-1 text-[10px] text-gray-400">
                {newestRow ? `Última recibida: #${newestRow.id}` : "Compras enviará las solicitudes"}
              </p>
            </div>
            <div className="h-fit rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[#8B1D35]/15 bg-white p-2 shadow-sm sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
              <Search size={16} className="text-[#8B1D35]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Buscar por folio, URE, solicitante o requisición"
              />
            </div>
            <button
              type="button"
              onClick={loadRows}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#8B1D35]/20 bg-[#8B1D35]/5 px-3 py-2 text-xs font-bold text-[#8B1D35] hover:bg-[#8B1D35]/10"
            >
              <RefreshCw size={14} />
              Actualizar bandeja
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#8B1D35]/15 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
              <h3 className="flex items-center gap-2 font-bold text-gray-800">
                <FileText size={18} className="text-[#8B1D35]" />
                Requisiciones recibidas
              </h3>
              <span className="text-xs font-semibold text-gray-400">Mostrando: {filteredRows.length}</span>
            </div>

            <div className="hidden grid-cols-[90px_minmax(0,1fr)_170px_130px_120px] border-b border-[#8B1D35]/10 bg-[#8B1D35]/[0.06] px-4 py-3 text-xs font-bold uppercase text-[#6F152B] md:grid">
              <span>Folio</span>
              <span>Requisición</span>
              <span>Solicitante</span>
              <span>Monto</span>
              <span>Acción</span>
            </div>

            {loading ? (
              <div className="px-3 py-12 text-center text-sm text-gray-500">Cargando requisiciones...</div>
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <FileText size={22} />
                </div>
                <p className="text-sm font-bold text-gray-700">No hay requisiciones en Finanzas</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">
                  Cuando Compras envíe una requisición, aparecerá aquí y también llegará una notificación en la campana.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 bg-gradient-to-b from-white to-gray-50/60">
                {filteredRows.map((row) => {
                  const days = getAgeDays(row);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => navigate(`/finanzas/requisiciones/${row.id}`)}
                      className="grid w-full gap-3 bg-white px-4 py-4 text-left text-sm transition hover:bg-[#8B1D35]/[0.04] md:grid-cols-[90px_minmax(0,1fr)_170px_130px_120px] md:items-center"
                    >
                      <span className="w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 font-extrabold text-gray-700">
                        #{row.id}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">
                          {row.request_name || "Sin nombre"}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{row.solicitante_ure || "Sin URE"}</span>
                          <span className={days >= 3 ? "font-bold text-red-600" : "font-semibold text-sky-700"}>
                            En Finanzas: {ageLabel(days)}
                          </span>
                        </span>
                      </span>
                      <span className="truncate text-xs font-semibold text-gray-600 md:text-sm">
                        {row.solicitante || "Solicitante"}
                      </span>
                      <span className="font-bold text-gray-800">{money(row.selected_total)}</span>
                      <span className="w-fit rounded-full border border-[#8B1D35]/20 bg-[#8B1D35]/5 px-2.5 py-1 text-xs font-bold text-[#8B1D35]">
                        Revisar
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <Clock size={16} className="text-[#8B1D35]" />
              Estado del flujo
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-gray-700">
                  <span>Compras envía</span>
                  <span>Status 15</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#8B1D35]" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-gray-700">
                  <span>Finanzas revisa</span>
                  <span>Ahora</span>
                </div>
                <div className="h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-gray-700">
                  <span>Compras finaliza</span>
                  <span>Status 16</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50 p-5 text-sky-900 shadow-sm">
            <h3 className="text-sm font-extrabold">Regla rápida</h3>
            <p className="mt-2 text-xs leading-relaxed">
              Para aprobar se debe capturar proyecto, fondo, programa estratégico y marcar presupuesto disponible.
              Si falta algo o hay duda, usa devolver a Compras con observación.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
