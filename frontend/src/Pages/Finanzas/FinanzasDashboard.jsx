import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
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

const ageDays = (row) => {
  const time = new Date(row?.entered_finanzas_at || row?.sent_on || row?.created_at).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
};

const ageLabel = (days) => {
  if (days <= 0) return "Hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

export default function FinanzasDashboard() {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const [pendingResp, historyResp] = await Promise.all([
        fetch(`${API_BASE_URL}/finanzas/recibidas`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/finanzas/historial`, { headers: getAuthHeaders() }),
        silent ? wait(650) : Promise.resolve(),
      ]);
      const pendingData = await pendingResp.json().catch(() => []);
      const historyData = await historyResp.json().catch(() => []);
      if (!pendingResp.ok) throw new Error(pendingData?.message || "Error al cargar recibidas");
      if (!historyResp.ok) throw new Error(historyData?.message || "Error al cargar historial");
      setPending(Array.isArray(pendingData) ? pendingData : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el dashboard de Finanzas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const priorityPending = useMemo(() => pending.filter((row) => ageDays(row) >= 3), [pending]);
  const pendingAmount = useMemo(
    () => pending.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
    [pending]
  );

  const monthRows = useMemo(() => {
    const key = currentMonthKey();
    return history.filter((row) => {
      const date = new Date(row.reviewed_at);
      if (Number.isNaN(date.getTime())) return false;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === key;
    });
  }, [history]);

  const monthSummary = useMemo(
    () => ({
      count: monthRows.length,
      amount: monthRows.reduce((acc, row) => acc + Number(row.selected_total || 0), 0),
      approved: monthRows.filter((row) => row.finance_result === "aprobada").length,
      returned: monthRows.filter((row) => row.finance_result === "devuelta").length,
      rejected: monthRows.filter((row) => row.finance_result === "rechazada").length,
    }),
    [monthRows]
  );

  const nextPending = useMemo(
    () =>
      [...pending]
        .sort((a, b) => {
          const ageDiff = ageDays(b) - ageDays(a);
          if (ageDiff !== 0) return ageDiff;
          return Number(b.selected_total || 0) - Number(a.selected_total || 0);
        })
        .slice(0, 5),
    [pending]
  );

  const latestHistory = useMemo(() => history.slice(0, 5), [history]);

  const cards = [
    {
      label: "Pendientes",
      value: pending.length,
      helper: "En bandeja de Finanzas",
      icon: LayoutGrid,
      accentCls: "bg-[#8B1D35]",
      iconCls: "bg-[#8B1D35]/10 text-[#8B1D35]",
      valueCls: "text-gray-900",
    },
    {
      label: "Monto pendiente",
      value: money(pendingAmount),
      helper: "Por validar presupuesto",
      icon: Banknote,
      accentCls: "bg-[#8B1D35]",
      iconCls: "bg-[#8B1D35]/10 text-[#8B1D35]",
      valueCls: "text-[#8B1D35]",
    },
    {
      label: "Prioridad",
      value: priorityPending.length,
      helper: "+3 días sin resolver",
      icon: AlertTriangle,
      accentCls: priorityPending.length > 0 ? "bg-red-500" : "bg-gray-300",
      iconCls: priorityPending.length > 0 ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500",
      valueCls: priorityPending.length > 0 ? "text-red-600" : "text-gray-900",
    },
    {
      label: "Revisadas del mes",
      value: monthSummary.count,
      helper: money(monthSummary.amount),
      icon: Archive,
      accentCls: "bg-emerald-500",
      iconCls: "bg-emerald-50 text-emerald-600",
      valueCls: "text-gray-900",
    },
  ];

  return (
    <section className="text-gray-900">
      <div className="mb-5 rounded-2xl border border-[#8B1D35]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#8B1D35]/10 text-[#8B1D35]">
              <Banknote size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">SIMCO Finanzas</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Panel de control</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
                Revisa pendientes, montos por validar y actividad reciente antes de entrar al detalle de cada compra.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={loading || refreshing}
            className={`inline-flex w-fit items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
              loading || refreshing
                ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                : "border-[#8B1D35]/30 bg-white text-[#8B1D35] hover:bg-[#8B1D35]/10"
            }`}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className={`h-1 ${card.accentCls}`} />
              <div className="flex justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className={`mt-1 truncate text-3xl font-extrabold ${card.valueCls}`}>{card.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-gray-400">{card.helper}</p>
                </div>
                <div className={`h-fit rounded-lg p-2 ${card.iconCls}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Resultado del mes</p>
            <p className="text-xs text-gray-500">Revisiones finalizadas durante el mes actual.</p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500">
            {monthSummary.count} revisión(es)
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Aprobadas</p>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{monthSummary.approved}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Devueltas</p>
              <RotateCcw size={16} className="text-amber-600" />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{monthSummary.returned}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Rechazadas</p>
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{monthSummary.rejected}</p>
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {refreshing && !loading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
            <FinanceLoader label="Actualizando..." />
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
            <h3 className="flex items-center gap-2 font-bold text-gray-800">
              <Clock size={18} className="text-[#8B1D35]" />
              Siguiente por revisar
            </h3>
            <button
              type="button"
              onClick={() => navigate("/finanzas/recibidas")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              Ver bandeja
            </button>
          </div>
          {loading ? (
            <FinanceLoader label="Cargando dashboard..." />
          ) : nextPending.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-sm font-bold text-gray-700">Sin pendientes por ahora</p>
              <p className="mt-1 text-xs text-gray-500">Cuando Compras envíe requisiciones, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {nextPending.map((row) => {
                const days = ageDays(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate(`/finanzas/requisiciones/${row.id}`)}
                    className="grid w-full gap-3 bg-white px-4 py-4 text-left transition hover:bg-[#8B1D35]/[0.04] md:grid-cols-[90px_minmax(0,1fr)_135px]"
                  >
                    <span className="w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-extrabold text-gray-700">
                      #{row.id}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-gray-900">
                        {row.request_name || "Sin nombre"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{row.solicitante_ure || "Sin URE"}</span>
                        <span className={days >= 3 ? "font-bold text-red-600" : "font-semibold text-sky-700"}>
                          En Finanzas: {ageLabel(days)}
                        </span>
                      </span>
                    </span>
                    <span className="font-bold text-[#8B1D35] md:text-right">{money(row.selected_total)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <FileText size={16} className="text-[#8B1D35]" />
              Actividad reciente
            </h3>
            <div className="mt-4 space-y-3">
              {loading ? (
                <p className="text-xs text-gray-500">Cargando actividad...</p>
              ) : latestHistory.length === 0 ? (
                <p className="text-xs text-gray-500">Aún no hay revisiones finalizadas.</p>
              ) : (
                latestHistory.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate(`/finanzas/requisiciones/${row.id}`)}
                    className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-gray-800">#{row.id} {row.request_name}</span>
                      <span className="shrink-0 text-xs font-extrabold text-[#8B1D35]">
                        {money(row.selected_total)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-gray-400">
                      {formatDate(row.reviewed_at)} · {row.finance_result || "revisada"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50 p-5 text-sky-900 shadow-sm">
            <h3 className="text-sm font-extrabold">Criterio de trabajo</h3>
            <p className="mt-2 text-xs leading-relaxed">
              Atiende primero requisiciones con más días en Finanzas o con mayor monto. El detalle conserva la revisión
              presupuestal y la observación si se devuelve o rechaza.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
