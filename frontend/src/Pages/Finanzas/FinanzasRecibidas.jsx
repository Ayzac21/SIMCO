import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  Filter,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../api/config";
import { getAuthHeaders } from "../../api/auth";
import FinanceLoader from "./components/FinanceLoader";

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

const getAgeDays = (row) => {
  const time = new Date(row?.entered_finanzas_at || row?.sent_on || row?.created_at).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
};

const ageLabel = (days) => {
  if (days <= 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
};

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

export default function FinanzasRecibidas() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("oldest");
  const [ureFilter, setUreFilter] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const loadRows = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const [resp] = await Promise.all([
        fetch(`${API_BASE_URL}/finanzas/recibidas`, {
          headers: getAuthHeaders(),
        }),
        silent ? wait(650) : Promise.resolve(),
      ]);
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data?.message || "Error al cargar requisiciones");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "No se pudieron cargar las requisiciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = String(query || "").trim().toLowerCase();
    const min = Number(minAmount);
    const max = Number(maxAmount);
    const hasMin = Number.isFinite(min) && min > 0;
    const hasMax = Number.isFinite(max) && max > 0;
    const result = rows.filter((row) => {
      const days = getAgeDays(row);
      const amount = Number(row.selected_total || 0);
      if (ageFilter === "priority" && days < 3) return false;
      if (ageFilter === "today" && days > 0) return false;
      if (ureFilter !== "all" && String(row.solicitante_ure || "") !== ureFilter) return false;
      if (hasMin && amount < min) return false;
      if (hasMax && amount > max) return false;
      if (!needle) return true;
      return [
        row.id,
        row.folio,
        row.area_folio,
        row.request_name,
        row.solicitante,
        row.solicitante_ure,
        row.project,
        row.fund,
        row.strategic_program,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle));
    });

    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.sent_on || b.created_at) - new Date(a.sent_on || a.created_at);
      }
      if (sortBy === "amount_desc") return Number(b.selected_total || 0) - Number(a.selected_total || 0);
      if (sortBy === "amount_asc") return Number(a.selected_total || 0) - Number(b.selected_total || 0);
      return new Date(a.sent_on || a.created_at) - new Date(b.sent_on || b.created_at);
    });

    return result;
  }, [rows, query, ageFilter, sortBy, ureFilter, minAmount, maxAmount]);

  const totalPending = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
    [rows]
  );
  const totalFiltered = useMemo(
    () => filteredRows.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
    [filteredRows]
  );

  const priorityRows = useMemo(() => rows.filter((row) => getAgeDays(row) >= 3), [rows]);
  const ureOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => String(row.solicitante_ure || "").trim()).filter(Boolean))];
    return values.sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);
  const hasAdvancedFilters =
    ureFilter !== "all" || String(minAmount || "").trim() || String(maxAmount || "").trim();
  const hasAnyFilter = hasAdvancedFilters || ageFilter !== "all" || String(query || "").trim();
  const clearFilters = () => {
    setQuery("");
    setAgeFilter("all");
    setUreFilter("all");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("oldest");
  };

  return (
    <section className="text-gray-900">
      <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Requisiciones recibidas</h2>
            <p className="mt-1 text-sm text-gray-500">Bandeja operativa para abrir y resolver pendientes.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
              Pendientes: {rows.length}
            </span>
            <span className="rounded-lg border border-[#8B1D35]/15 bg-[#8B1D35]/5 px-3 py-2 text-[#8B1D35]">
              Monto: {money(totalPending)}
            </span>
            {hasAnyFilter && (
              <span className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sky-700">
                Filtrado: {filteredRows.length} / {money(totalFiltered)}
              </span>
            )}
            {priorityRows.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-600">
                <AlertTriangle size={13} />
                Prioridad: {priorityRows.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
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
              onClick={() => loadRows({ silent: true })}
              disabled={loading || refreshing}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                loading || refreshing
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : "border-[#8B1D35]/30 bg-white text-[#8B1D35] hover:bg-[#8B1D35]/10"
              }`}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Actualizando..." : "Actualizar bandeja"}
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[
              ["all", `Todas (${rows.length})`],
              ["priority", `Prioridad +3 días (${priorityRows.length})`],
              ["today", "Recibidas hoy"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAgeFilter(key)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                  ageFilter === key
                    ? "border-[#8B1D35] bg-[#8B1D35] text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                <X size={13} />
                Limpiar filtros
              </button>
            )}
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B1D35]"
            >
              <option value="oldest">Más antiguas primero</option>
              <option value="newest">Más recientes primero</option>
              <option value="amount_desc">Monto mayor</option>
              <option value="amount_asc">Monto menor</option>
            </select>
          </div>

          <div className="mb-3 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_140px_140px_auto] lg:items-end">
            <label className="block text-xs font-bold uppercase text-gray-600">
              URE
              <select
                value={ureFilter}
                onChange={(event) => setUreFilter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-800 outline-none focus:border-[#8B1D35]"
              >
                <option value="all">Todas las URE</option>
                {ureOptions.map((ure) => (
                  <option key={ure} value={ure}>
                    {ure}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase text-gray-600">
              Monto mínimo
              <input
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-800 outline-none focus:border-[#8B1D35]"
                placeholder="0.00"
              />
            </label>
            <label className="block text-xs font-bold uppercase text-gray-600">
              Monto máximo
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-800 outline-none focus:border-[#8B1D35]"
                placeholder="0.00"
              />
            </label>
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
              <Filter size={14} className="text-[#8B1D35]" />
              {hasAdvancedFilters ? "Filtros activos" : "Sin filtros avanzados"}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#8B1D35]/15 bg-white shadow-sm">
            {refreshing && !loading && (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
                <FinanceLoader label="Actualizando..." />
              </div>
            )}
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
              <FinanceLoader label="Cargando requisiciones..." />
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <FileText size={22} />
                </div>
                <p className="text-sm font-bold text-gray-700">
                  {rows.length ? "No hay requisiciones con estos filtros" : "No hay requisiciones en Finanzas"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">
                  {rows.length
                    ? "Ajusta la búsqueda, cambia el filtro de antigüedad o actualiza la bandeja."
                    : "Cuando Compras envíe una requisición, aparecerá aquí y también llegará una notificación en la campana."}
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
    </section>
  );
}
