import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, CheckCircle2, Download, FileText, RefreshCw, RotateCcw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../api/config";
import { getAuthHeaders } from "../../api/auth";

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const resultBadge = (result) => {
  if (result === "aprobada") {
    return {
      label: "Aprobada",
      icon: CheckCircle2,
      cls: "border-emerald-100 bg-emerald-50 text-emerald-700",
    };
  }
  if (result === "devuelta") {
    return {
      label: "Devuelta",
      icon: RotateCcw,
      cls: "border-amber-100 bg-amber-50 text-amber-700",
    };
  }
  if (result === "rechazada") {
    return {
      label: "Rechazada",
      icon: XCircle,
      cls: "border-red-100 bg-red-50 text-red-700",
    };
  }
  return {
    label: "Revisada",
    icon: FileText,
    cls: "border-gray-200 bg-gray-100 text-gray-700",
  };
};

export default function FinanzasHistorial() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const loadRows = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_URL}/finanzas/historial`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(data?.message || "Error al cargar historial");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el historial de Finanzas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const counts = useMemo(
    () => ({
      total: rows.length,
      aprobada: rows.filter((row) => row.finance_result === "aprobada").length,
      devuelta: rows.filter((row) => row.finance_result === "devuelta").length,
      rechazada: rows.filter((row) => row.finance_result === "rechazada").length,
    }),
    [rows]
  );

  const totalReviewed = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
    [rows]
  );

  const availableMonths = useMemo(() => {
    const months = new Map();
    rows.forEach((row) => {
      const date = new Date(row.reviewed_at);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
      months.set(key, label);
    });
    return [...months.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = String(query || "").trim().toLowerCase();
    const result = rows.filter((row) => {
      if (filter !== "all" && row.finance_result !== filter) return false;
      if (monthFilter !== "all") {
        const date = new Date(row.reviewed_at);
        const key = Number.isNaN(date.getTime())
          ? ""
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthFilter) return false;
      }
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
        row.finance_observation,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(needle));
    });

    result.sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.reviewed_at) - new Date(b.reviewed_at);
      if (sortBy === "amount_desc") return Number(b.selected_total || 0) - Number(a.selected_total || 0);
      if (sortBy === "amount_asc") return Number(a.selected_total || 0) - Number(b.selected_total || 0);
      if (sortBy === "project") return String(a.project || "").localeCompare(String(b.project || ""), "es");
      return new Date(b.reviewed_at) - new Date(a.reviewed_at);
    });

    return result;
  }, [rows, query, filter, monthFilter, sortBy]);

  const exportCsv = () => {
    const headers = [
      "ID",
      "Resultado",
      "Requisicion",
      "Solicitante",
      "URE",
      "Proyecto",
      "Fondo",
      "Programa",
      "Monto",
      "Reviso",
      "Fecha revision",
      "Observacion",
    ];
    const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = filteredRows.map((row) =>
      [
        row.id,
        resultBadge(row.finance_result).label,
        row.request_name,
        row.solicitante,
        row.solicitante_ure,
        row.project,
        row.fund,
        row.strategic_program,
        Number(row.selected_total || 0).toFixed(2),
        row.revisado_por || "Finanzas",
        formatDate(row.reviewed_at),
        row.finance_observation,
      ]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historial-finanzas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="text-gray-900">
      <div className="mb-5 rounded-2xl border border-[#8B1D35]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#8B1D35]/10 text-[#8B1D35]">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">SIMCO Finanzas</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Historial de revisiones</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
                Consulta las requisiciones que Finanzas ya procesó, con proyecto, fondo, programa, observación y
                resultado de la revisión.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={loadRows}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-[#8B1D35]/20 bg-[#8B1D35]/5 px-3 py-2 text-xs font-bold text-[#8B1D35] hover:bg-[#8B1D35]/10"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Revisadas</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Aprobadas</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{counts.aprobada}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Devueltas</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{counts.devuelta}</p>
        </div>
        <div className="rounded-xl border border-[#8B1D35]/20 bg-[#fff8f8] p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Monto revisado</p>
          <p className="mt-1 text-3xl font-extrabold text-[#8B1D35]">{money(totalReviewed)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", `Todas (${counts.total})`],
            ["aprobada", `Aprobadas (${counts.aprobada})`],
            ["devuelta", `Devueltas (${counts.devuelta})`],
            ["rechazada", `Rechazadas (${counts.rechazada})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                filter === key
                  ? "border-[#8B1D35] bg-[#8B1D35] text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-[#8B1D35]"
              placeholder="Buscar por #, proyecto, fondo, solicitante..."
            />
          </div>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B1D35]"
          >
            <option value="all">Todos los meses</option>
            {availableMonths.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#8B1D35]"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguas</option>
            <option value="amount_desc">Monto mayor</option>
            <option value="amount_asc">Monto menor</option>
            <option value="project">Proyecto A-Z</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
          <h3 className="flex items-center gap-2 font-bold text-gray-800">
            <Banknote size={18} className="text-[#8B1D35]" />
            Revisiones procesadas
          </h3>
          <span className="text-xs font-semibold text-gray-400">Mostrando: {filteredRows.length}</span>
        </div>

        {loading ? (
          <div className="px-3 py-12 text-center text-sm text-gray-500">Cargando historial...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <FileText size={22} />
            </div>
            <p className="text-sm font-bold text-gray-700">Sin revisiones en el historial</p>
            <p className="mt-1 text-xs text-gray-500">Cuando Finanzas apruebe, devuelva o rechace, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 bg-gradient-to-b from-white to-gray-50/60">
            {filteredRows.map((row) => {
              const badge = resultBadge(row.finance_result);
              const BadgeIcon = badge.icon;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => navigate(`/finanzas/requisiciones/${row.id}`)}
                  className="w-full bg-white px-4 py-4 text-left transition hover:bg-[#8B1D35]/[0.04]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-extrabold text-gray-700">
                          #{row.id}
                        </span>
                        <span className="font-bold text-gray-900">{row.request_name || "Sin nombre"}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${badge.cls}`}>
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{row.solicitante_ure || "Sin URE"}</span>
                        <span>{row.solicitante || "Solicitante"}</span>
                        <span>Revisó: {row.revisado_por || "Finanzas"}</span>
                        <span>{formatDate(row.reviewed_at)}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
                          <b>Proyecto:</b> {row.project || "—"}
                        </span>
                        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
                          <b>Fondo:</b> {row.fund || "—"}
                        </span>
                        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
                          <b>Programa:</b> {row.strategic_program || "—"}
                        </span>
                      </div>
                      {row.finance_observation && (
                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500">
                          {row.finance_observation}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-left lg:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Monto</p>
                      <p className="mt-1 text-lg font-extrabold text-[#8B1D35]">{money(row.selected_total)}</p>
                      <span className="mt-2 inline-flex rounded-full border border-[#8B1D35]/20 bg-[#8B1D35]/5 px-2.5 py-1 text-xs font-bold text-[#8B1D35]">
                        Ver detalle
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
