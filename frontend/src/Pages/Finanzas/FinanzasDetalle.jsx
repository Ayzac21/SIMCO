import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  FileText,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../../api/config";
import { getAuthHeaders } from "../../api/auth";
import ConfirmModal from "../../components/ConfirmModal";
import RequisitionTimelineModal from "../../components/RequisitionTimelineModal";

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

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const emptyForm = {
  project: "",
  fund: "",
  strategic_program: "",
  budget_available: null,
  comment: "",
};

const financeResultDisplay = (result) => {
  if (result === "aprobada") {
    return {
      label: "Aprobada por Finanzas",
      cls: "border-emerald-100 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  if (result === "devuelta") {
    return {
      label: "Devuelta a Compras",
      cls: "border-amber-100 bg-amber-50 text-amber-700",
      icon: RotateCcw,
    };
  }
  if (result === "rechazada") {
    return {
      label: "Rechazada por Finanzas",
      cls: "border-red-100 bg-red-50 text-red-700",
      icon: XCircle,
    };
  }
  if (result === "pendiente") {
    return {
      label: "Pendiente de revisión",
      cls: "border-sky-100 bg-sky-50 text-sky-700",
      icon: AlertTriangle,
    };
  }
  return {
    label: "Revisada",
    cls: "border-gray-200 bg-gray-100 text-gray-700",
    icon: FileText,
  };
};

const financeEventDisplay = (event) => {
  if (event === "recibida") {
    return {
      title: "Compras envió a Finanzas",
      cls: "border-sky-100 bg-sky-50 text-sky-700",
      dot: "bg-sky-500",
    };
  }
  if (event === "aprobada") {
    return {
      title: "Finanzas aprobó",
      cls: "border-emerald-100 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }
  if (event === "devuelta") {
    return {
      title: "Finanzas devolvió a Compras",
      cls: "border-amber-100 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    };
  }
  if (event === "rechazada") {
    return {
      title: "Finanzas rechazó",
      cls: "border-red-100 bg-red-50 text-red-700",
      dot: "bg-red-500",
    };
  }
  return {
    title: "Movimiento financiero",
    cls: "border-gray-100 bg-gray-50 text-gray-700",
    dot: "bg-gray-400",
  };
};

const actorLabel = (event) => {
  const role = String(event?.changed_by_role || "").toLowerCase();
  const name = String(event?.changed_by_name || "").trim();
  if (role === "compras_admin") return name ? `Compras Admin · ${name}` : "Compras Admin";
  if (role === "compras_operador") return name ? `Compras Operador · ${name}` : "Compras Operador";
  if (role === "finanzas" || role.startsWith("finanzas_")) return name ? `Finanzas · ${name}` : "Finanzas";
  if (role === "sistema") return "Sistema";
  return name || "Sin responsable registrado";
};

export default function FinanzasDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requisition, setRequisition] = useState(null);
  const [items, setItems] = useState([]);
  const [financeTimeline, setFinanceTimeline] = useState([]);
  const [catalogOptions, setCatalogOptions] = useState({ project: [], fund: [], program: [] });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const currentUser = useMemo(() => {
    const raw = localStorage.getItem("usuario");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${API_BASE_URL}/finanzas/requisiciones/${id}`, {
          headers: getAuthHeaders(),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || "Error al cargar el detalle");
        if (cancelled) return;

        const req = data?.requisition || null;
        setRequisition(req);
        setItems(Array.isArray(data?.items) ? data.items : []);
        setFinanceTimeline(Array.isArray(data?.finance_timeline) ? data.finance_timeline : []);
        setForm({
          project: req?.project || "",
          fund: req?.fund || "",
          strategic_program: req?.strategic_program || "",
          budget_available:
            req?.budget_available === null || req?.budget_available === undefined
              ? null
              : Boolean(req.budget_available),
          comment: req?.finance_observation || "",
        });
      } catch (error) {
        if (!cancelled) toast.error(error?.message || "No se pudo cargar la requisición");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalogOptions = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/finanzas/catalog-options`, {
          headers: getAuthHeaders(),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error();
        if (!cancelled) {
          setCatalogOptions({
            project: Array.isArray(data?.project) ? data.project : [],
            fund: Array.isArray(data?.fund) ? data.fund : [],
            program: Array.isArray(data?.program) ? data.program : [],
          });
        }
      } catch {
        if (!cancelled) {
          setCatalogOptions({ project: [], fund: [], program: [] });
        }
      }
    };

    loadCatalogOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTotal = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.selected_total || 0), 0),
    [items]
  );
  const mainProviders = useMemo(() => {
    const names = [...new Set(items.map((item) => item.provider_name).filter(Boolean))];
    if (names.length === 0) return "Sin proveedor seleccionado";
    if (names.length === 1) return names[0];
    return `${names.length} proveedores seleccionados`;
  }, [items]);

  const missingForApproval = useMemo(() => {
    const missing = [];
    if (!String(form.project || "").trim()) missing.push("proyecto");
    if (!String(form.fund || "").trim()) missing.push("fondo");
    if (!String(form.strategic_program || "").trim()) missing.push("programa estratégico");
    if (!form.budget_available) missing.push("presupuesto disponible");
    return missing;
  }, [form]);

  const commentRequiredMissing = !String(form.comment || "").trim();
  const canResolveFinance = ["finanzas", "finanzas_admin", "finanzas_analista"].includes(currentUser?.role);
  const canReview = canResolveFinance && Number(requisition?.statuses_id || 0) === 15;
  const reviewStatus = financeResultDisplay(requisition?.finance_result);
  const ReviewStatusIcon = reviewStatus.icon;
  const budgetCaptured = requisition?.budget_available !== null && requisition?.budget_available !== undefined;
  const showFinanceReason =
    ["devuelta", "rechazada"].includes(requisition?.finance_result) &&
    String(requisition?.finance_observation || "").trim();
  const actionConfig = {
    aprobar: {
      title: "Aprobar por Finanzas",
      headerText: "Confirmar aprobación",
      description:
        "La requisición pasará a Compras como aprobada por Finanzas y ya podrá continuar al cierre de compra.",
      confirmText: "Aprobar",
      variant: "success",
      icon: CheckCircle2,
    },
    devolver_a_compras: {
      title: "Devolver a Compras",
      headerText: "Confirmar devolución",
      description:
        "La requisición regresará a Compras con la observación financiera capturada para que puedan corregirla.",
      confirmText: "Devolver",
      variant: "warning",
      icon: RotateCcw,
    },
    rechazar: {
      title: "Rechazar por Finanzas",
      headerText: "Confirmar rechazo",
      description:
        "La requisición quedará rechazada por Finanzas y se notificará a los usuarios relacionados.",
      confirmText: "Rechazar",
      variant: "danger",
      icon: XCircle,
    },
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderCatalogSelect = ({ field, label, options, value }) => {
    const currentValue = String(value || "");
    const hasCurrent = !currentValue || options.some((option) => option.name === currentValue);
    return (
      <label className="block text-xs font-bold uppercase text-gray-600">
        {label} <span className="text-red-600">*</span>
        <select
          value={currentValue}
          onChange={(event) => updateField(field, event.target.value)}
          disabled={!canReview}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case text-gray-800 outline-none transition focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">Seleccionar...</option>
          {!hasCurrent && <option value={currentValue}>{currentValue} (actual)</option>}
          {options.map((option) => (
            <option key={option.id} value={option.name}>
              {option.code ? `${option.code} - ${option.name}` : option.name}
              {option.fiscal_year ? ` (${option.fiscal_year})` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const resolveReview = async (action) => {
    if (!requisition?.id || savingAction) return;

    try {
      setSavingAction(action);
      const resp = await fetch(`${API_BASE_URL}/finanzas/requisiciones/${requisition.id}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action, ...form }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "No se pudo actualizar Finanzas");

      toast.success(data?.message || "Revisión financiera actualizada");
      navigate("/finanzas/recibidas");
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar Finanzas");
    } finally {
      setSavingAction("");
      setPendingAction("");
    }
  };

  const requestAction = (action) => {
    if (action === "aprobar" && missingForApproval.length > 0) {
      toast.error(`Falta capturar: ${missingForApproval.join(", ")}`);
      return;
    }
    if ((action === "devolver_a_compras" || action === "rechazar") && commentRequiredMissing) {
      toast.error("La observación financiera es obligatoria para devolver o rechazar");
      return;
    }
    setPendingAction(action);
  };

  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-sm text-gray-500">
        Cargando detalle de Finanzas...
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-bold text-gray-700">No se encontró la requisición.</p>
        <button
          type="button"
          onClick={() => navigate("/finanzas/recibidas")}
          className="mt-4 rounded-lg bg-secundario px-4 py-2 text-xs font-bold text-white"
        >
          Volver a recibidas
        </button>
      </div>
    );
  }

  return (
    <section className="text-gray-900">
      <ConfirmModal
        open={Boolean(pendingAction)}
        title={actionConfig[pendingAction]?.title}
        headerText={actionConfig[pendingAction]?.headerText}
        description={actionConfig[pendingAction]?.description}
        confirmText={actionConfig[pendingAction]?.confirmText}
        loading={Boolean(savingAction)}
        variant={actionConfig[pendingAction]?.variant}
        icon={actionConfig[pendingAction]?.icon || AlertTriangle}
        highlight={`Requisición #${requisition.id}`}
        onCancel={() => {
          if (!savingAction) setPendingAction("");
        }}
        onConfirm={() => resolveReview(pendingAction)}
      />
      <RequisitionTimelineModal
        open={timelineOpen}
        requisitionId={requisition.id}
        onClose={() => setTimelineOpen(false)}
      />

      <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-[#8B1D35] via-[#A63A50] to-[#D7B56D]" />
        <div className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/finanzas/recibidas")}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#8B1D35] shadow-sm hover:bg-[#8B1D35]/5"
              aria-label="Volver a recibidas"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">SIMCO Finanzas</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Requisición #{requisition.id}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Revisa la información de compra y captura proyecto, fondo y programa estratégico.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTimelineOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Ver progreso
          </button>
        </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-br from-[#8B1D35]/[0.06] to-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">Resumen de lo solicitado</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
                {items.length === 1 ? "1 artículo por validar" : `${items.length} artículos por validar`}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Finanzas debe validar que el monto de la selección corresponde al proyecto, fondo y programa estratégico
                correctos antes de liberar el cierre de compra.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Proveedor seleccionado</p>
                <p className="mt-1 truncate text-sm font-extrabold text-gray-900">{mainProviders}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Total de artículos</p>
                <p className="mt-1 text-sm font-extrabold text-gray-900">{items.length}</p>
              </div>
              <div className="rounded-xl border border-[#8B1D35]/15 bg-[#8B1D35]/[0.04] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B1D35]">Monto a validar</p>
                <p className="mt-1 text-lg font-extrabold text-[#8B1D35]">{money(selectedTotal)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">Información base</p>
                <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
                  {requisition.request_name || "Sin nombre"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {requisition.solicitante_ure || "Sin URE"} · {requisition.solicitante || "Solicitante"} ·{" "}
                  {formatDate(requisition.sent_on || requisition.created_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#8B1D35]/15 bg-gradient-to-br from-[#8B1D35]/[0.07] to-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Monto seleccionado</p>
                <p className="mt-1 text-2xl font-extrabold text-[#8B1D35]">{money(selectedTotal)}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#8B1D35]">Bitácora financiera</p>
                  <h3 className="mt-1 text-lg font-extrabold text-gray-900">Resultado de revisión</h3>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${reviewStatus.cls}`}
                >
                  <ReviewStatusIcon size={14} />
                  {reviewStatus.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-gray-500">Revisó</span>
                  <span className="mt-1 block text-sm font-bold text-gray-800">
                    {requisition.revisado_por || "Pendiente"}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-gray-500">Fecha de revisión</span>
                  <span className="mt-1 block text-sm font-bold text-gray-800">
                    {formatDate(requisition.reviewed_at)}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="block text-[10px] font-bold uppercase text-gray-500">Presupuesto</span>
                  <span
                    className={`mt-1 block text-sm font-bold ${
                      !budgetCaptured ? "text-gray-500" : requisition.budget_available ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {!budgetCaptured ? "Pendiente" : requisition.budget_available ? "Disponible" : "No disponible"}
                  </span>
                </div>
              </div>

              <div
                className={`mt-3 rounded-lg border px-3 py-3 ${
                  showFinanceReason ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  {showFinanceReason ? "Motivo visible para Compras" : "Observación financiera"}
                </p>
                <p
                  className={`mt-1 text-sm leading-relaxed ${
                    showFinanceReason ? "font-semibold text-amber-900" : "text-gray-700"
                  }`}
                >
                  {requisition.finance_observation || "Sin observación financiera registrada."}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      Movimientos de Finanzas
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      Entrada, revisión y resolución de la requisición.
                    </p>
                  </div>
                  <Clock3 size={16} className="text-[#8B1D35]" />
                </div>

                {financeTimeline.length === 0 ? (
                  <div className="px-3 py-4 text-sm font-semibold text-gray-500">
                    Sin movimientos financieros registrados en la bitácora.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {financeTimeline.map((event) => {
                      const display = financeEventDisplay(event.finance_event);
                      return (
                        <div key={event.id} className="grid gap-3 px-3 py-3 md:grid-cols-[160px_minmax(0,1fr)]">
                          <div>
                            <p className="text-xs font-extrabold text-gray-900">
                              {formatDateTime(event.changed_at)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-gray-500">{actorLabel(event)}</p>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${display.dot}`} />
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${display.cls}`}
                              >
                                {display.title}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-500">
                                {event.from_status_name || "Inicio"} → {event.to_status_name || "Siguiente paso"}
                              </span>
                            </div>
                            {event.change_note && (
                              <p className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium leading-relaxed text-gray-700">
                                {event.change_note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="block text-[10px] font-bold uppercase text-gray-500">Folio</span>
                <span className="mt-1 block font-semibold text-gray-800">
                  {requisition.area_folio || requisition.folio || "—"}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="block text-[10px] font-bold uppercase text-gray-500">Estatus</span>
                <span className="mt-1 block font-semibold text-gray-800">
                  {requisition.nombre_estatus || `Estatus ${requisition.statuses_id}`}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="block text-[10px] font-bold uppercase text-gray-500">Artículos</span>
                <span className="mt-1 block font-semibold text-gray-800">{items.length}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B1D35]">Proyecto</p>
                <p className={`mt-1 text-sm font-bold ${form.project ? "text-gray-800" : "text-gray-400"}`}>
                  {form.project || "Pendiente de captura"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B1D35]">Fondo</p>
                <p className={`mt-1 text-sm font-bold ${form.fund ? "text-gray-800" : "text-gray-400"}`}>
                  {form.fund || "Pendiente de captura"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B1D35]">Programa estratégico</p>
                <p className={`mt-1 text-sm font-bold ${form.strategic_program ? "text-gray-800" : "text-gray-400"}`}>
                  {form.strategic_program || "Pendiente de captura"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Justificación</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {requisition.justification || "Sin justificación registrada."}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Observaciones</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {requisition.observation || requisition.notes || "Sin observaciones registradas."}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-gray-100 bg-white px-4 py-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#8B1D35]" />
                <h2 className="text-sm font-extrabold text-[#6F152B]">Detalle de lo que se está comprando</h2>
              </div>
              <p className="text-xs text-gray-500">
                Revisa producto, descripción, cantidad, proveedor elegido y costo seleccionado por Compras.
              </p>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No hay artículos registrados.</div>
            ) : (
              <div className="space-y-3 bg-gray-50/70 p-4">
                {items.map((item, index) => {
                  const subtotal = Number(item.selected_subtotal || 0);
                  const vatAmount = Number(item.selected_vat_amount || 0);
                  const isrAmount = Number(item.selected_isr_amount || 0);
                  const vatPct = Number(item.selected_vat_percentage || 0);
                  const isrPct = Number(item.selected_isr_percentage || 0);
                  const hasTaxes = vatAmount > 0 || isrAmount > 0;
                  return (
                  <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#8B1D35]/10 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#8B1D35]">
                            Artículo {index + 1}
                          </span>
                          <h3 className="text-lg font-extrabold text-gray-900">
                            {item.product_name || "Sin producto"}
                          </h3>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                          {item.selected_description || item.description || "Sin descripción registrada"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#8B1D35]/15 bg-[#8B1D35]/[0.04] px-4 py-3 lg:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#8B1D35]">Total seleccionado</p>
                        <p className="mt-1 text-xl font-extrabold text-[#8B1D35]">{money(item.selected_total)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Cantidad</p>
                        <p className="mt-1 text-sm font-extrabold text-gray-900">
                          {Number(item.quantity || 0)} {item.unit || ""}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Proveedor elegido</p>
                        <p
                          className={`mt-1 truncate text-sm font-extrabold ${
                            item.provider_name ? "text-gray-900" : "text-red-600"
                          }`}
                        >
                          {item.provider_name || "Sin proveedor seleccionado"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Precio unitario</p>
                        <p className="mt-1 text-sm font-extrabold text-gray-900">
                          {money(item.selected_unit_price)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Desglose del importe
                        </p>
                        {hasTaxes && (
                          <span className="rounded-full border border-[#8B1D35]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#8B1D35]">
                            Incluye impuestos
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                        <div>
                          <p className="font-bold uppercase text-gray-400">Subtotal</p>
                          <p className="mt-0.5 font-extrabold text-gray-800">{money(subtotal)}</p>
                        </div>
                        <div>
                          <p className="font-bold uppercase text-gray-400">IVA {vatPct ? `${vatPct}%` : ""}</p>
                          <p className="mt-0.5 font-extrabold text-emerald-700">
                            {vatAmount > 0 ? money(vatAmount) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold uppercase text-gray-400">ISR {isrPct ? `${isrPct}%` : ""}</p>
                          <p className="mt-0.5 font-extrabold text-blue-700">
                            {isrAmount > 0 ? `-${money(isrAmount)}` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold uppercase text-gray-400">Total</p>
                          <p className="mt-0.5 font-extrabold text-[#8B1D35]">{money(item.selected_total)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100dvh-40px)] xl:overflow-y-auto">
          <div className="border-b border-gray-100 bg-gradient-to-br from-white to-[#8B1D35]/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#8B1D35] shadow-sm ring-1 ring-[#8B1D35]/10">
              <Banknote size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Captura financiera</p>
              <h2 className="text-lg font-extrabold text-gray-900">Proyecto y presupuesto</h2>
            </div>
          </div>
          </div>

          <div className="p-5">

          {!canReview && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              {canResolveFinance
                ? "Esta requisición ya no está en revisión de Finanzas."
                : "Tu perfil de Finanzas es solo lectura."}
            </div>
          )}

          <div className="space-y-4">
            {missingForApproval.length > 0 && canReview && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Para aprobar falta: {missingForApproval.join(", ")}.
              </div>
            )}

            {renderCatalogSelect({
              field: "project",
              label: "Proyecto",
              options: catalogOptions.project,
              value: form.project,
            })}

            {renderCatalogSelect({
              field: "fund",
              label: "Fondo",
              options: catalogOptions.fund,
              value: form.fund,
            })}

            {renderCatalogSelect({
              field: "strategic_program",
              label: "Programa estratégico",
              options: catalogOptions.program,
              value: form.strategic_program,
            })}

            <div>
              <p className="mb-1 text-xs font-bold uppercase text-gray-600">
                Presupuesto <span className="text-red-600">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5">
                <button
                  type="button"
                  onClick={() => updateField("budget_available", true)}
                  disabled={!canReview}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.budget_available === true
                      ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                      : "text-gray-500 hover:bg-white"
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Disponible
                </button>
                <button
                  type="button"
                  onClick={() => updateField("budget_available", false)}
                  disabled={!canReview}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.budget_available === false
                      ? "bg-white text-red-700 shadow-sm ring-1 ring-red-200"
                      : "text-gray-500 hover:bg-white"
                  }`}
                >
                  <XCircle size={14} />
                  No disponible
                </button>
              </div>
            </div>

            <label className="block text-xs font-bold uppercase text-gray-600">
              Observación financiera
              <textarea
                value={form.comment}
                onChange={(event) => updateField("comment", event.target.value)}
                disabled={!canReview}
                rows={5}
                className="mt-1 w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-medium normal-case outline-none transition focus:border-[#8B1D35] focus:ring-2 focus:ring-[#8B1D35]/10 disabled:bg-gray-100"
                placeholder="Obligatorio si se devuelve o rechaza."
              />
            </label>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => requestAction("aprobar")}
                disabled={!canReview || Boolean(savingAction) || missingForApproval.length > 0}
                title={missingForApproval.length ? `Falta: ${missingForApproval.join(", ")}` : "Aprobar revisión financiera"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1D35] px-3 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#74182c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
              >
                <CheckCircle2 size={14} />
                Aprobar por Finanzas
              </button>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => requestAction("devolver_a_compras")}
                  disabled={!canReview || Boolean(savingAction) || commentRequiredMissing}
                  title={commentRequiredMissing ? "Comentario obligatorio para devolver" : "Devolver a Compras"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#8B1D35]/25 bg-white px-3 py-3 text-xs font-bold text-[#8B1D35] hover:bg-[#8B1D35]/5 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                >
                  <RotateCcw size={14} />
                  Devolver a Compras
                </button>
                <button
                  type="button"
                  onClick={() => requestAction("rechazar")}
                  disabled={!canReview || Boolean(savingAction) || commentRequiredMissing}
                  title={commentRequiredMissing ? "Comentario obligatorio para rechazar" : "Rechazar por Finanzas"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                >
                  <XCircle size={14} />
                  Rechazar
                </button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-gray-500">
              Para aprobar se requiere proyecto, fondo, programa estratégico y presupuesto disponible. Para devolver o
              rechazar se requiere observación.
            </p>
          </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
