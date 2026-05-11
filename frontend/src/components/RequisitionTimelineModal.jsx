import React, { useEffect, useMemo, useState } from "react";
import { Clock3, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "../api/config";
import { getAuthHeaders } from "../api/auth";
import useEscapeKey from "../hooks/useEscapeKey";

function fmt(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs) || bMs < aMs) return null;
  return (bMs - aMs) / (1000 * 60 * 60 * 24);
}

function formatDuration(from, to) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";

  let remaining = end - start;
  const dayMs = 1000 * 60 * 60 * 24;
  const hourMs = 1000 * 60 * 60;
  const minuteMs = 1000 * 60;

  const days = Math.floor(remaining / dayMs);
  remaining -= days * dayMs;
  const hours = Math.floor(remaining / hourMs);
  remaining -= hours * hourMs;
  const minutes = Math.floor(remaining / minuteMs);

  if (days > 0) return `${days} día(s) ${hours} hora(s)`;
  if (hours > 0) return `${hours} hora(s) ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
}

function toMs(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

const STEP_FLOW = [7, 8, 9, 12, 14, 13, 11];
const STEP_LABELS = {
  7: "Creada",
  8: "Validación Coordinación",
  9: "Validación Secretaría",
  12: "Cotizando",
  14: "Cotizada (Revisión)",
  13: "Proceso admvo. de compra",
  11: "Finalizada",
};

function transitionLabel(evt) {
  const toLabel = evt.to_status_name || STEP_LABELS[Number(evt.to_status_id)] || `Paso #${evt.to_status_id}`;
  const fromId = Number(evt.from_status_id || 0);
  const fromLabel =
    evt.from_status_name ||
    (fromId ? STEP_LABELS[fromId] || `Paso #${fromId}` : "Inicio del flujo");
  return { fromLabel, toLabel };
}

function actorLabel(evt) {
  const role = String(evt?.changed_by_role || "").toLowerCase();
  const name = String(evt?.changed_by_name || "").trim();
  if (role === "coordinador") return name ? `Coordinación (${name})` : "Coordinación";
  if (role === "secretaria") return name ? `Secretaría (${name})` : "Secretaría";
  if (role === "compras_admin") return name ? `Compras Admin (${name})` : "Compras Admin";
  if (role === "compras_operador") return name ? `Compras Operador (${name})` : "Compras Operador";
  if (role === "head_office") return name ? `Solicitante (${name})` : "Solicitante";
  if (role === "sistema") return "Sistema";
  if (name) return name;
  return `Usuario #${evt?.changed_by || "—"}`;
}

export default function RequisitionTimelineModal({ open, requisitionId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [assignmentTimeline, setAssignmentTimeline] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [reqMeta, setReqMeta] = useState(null);
  const [inferred, setInferred] = useState(false);

  useEscapeKey(open, () => onClose?.(), loading);

  useEffect(() => {
    if (!open || !requisitionId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const resp = await fetch(`${API_BASE_URL}/timeline/requisiciones/${requisitionId}`, {
          headers: getAuthHeaders(),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || "No se pudo cargar el historial");
        if (cancelled) return;
        setTimeline(Array.isArray(data?.statusTimeline) ? data.statusTimeline : []);
        setAssignmentTimeline(Array.isArray(data?.assignmentTimeline) ? data.assignmentTimeline : []);
        setReqMeta(data?.requisition || null);
        setInferred(Boolean(data?.inferred));
      } catch (e) {
        if (!cancelled) toast.error(e?.message || "Error cargando historial");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, requisitionId]);

  const totalDays = useMemo(() => {
    if (!reqMeta?.created_at) return null;
    const end = timeline.length ? timeline[timeline.length - 1]?.changed_at : null;
    return daysBetween(reqMeta.created_at, end);
  }, [reqMeta, timeline]);

  const combinedHistory = useMemo(() => {
    const statusEvents = (timeline || []).map((evt) => ({ ...evt, event_type: "status" }));
    const assignmentEvents = (assignmentTimeline || []).map((evt) => ({
      ...evt,
      event_type: "assignment",
    }));
    return [...statusEvents, ...assignmentEvents].sort((a, b) => {
      const aTs = new Date(a?.changed_at || 0).getTime();
      const bTs = new Date(b?.changed_at || 0).getTime();
      if (aTs !== bTs) return aTs - bTs;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
  }, [timeline, assignmentTimeline]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === "status") {
      return combinedHistory.filter((evt) => evt?.event_type === "status");
    }
    if (historyFilter === "assignment") {
      return combinedHistory.filter((evt) => evt?.event_type === "assignment");
    }
    return combinedHistory;
  }, [combinedHistory, historyFilter]);

  const assignmentDurationById = useMemo(() => {
    const map = {};
    const items = [...(assignmentTimeline || [])].sort((a, b) => {
      const aTs = new Date(a?.changed_at || 0).getTime();
      const bTs = new Date(b?.changed_at || 0).getTime();
      if (aTs !== bTs) return aTs - bTs;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    const flowEndAt =
      timeline.length > 0 ? timeline[timeline.length - 1]?.changed_at || null : null;

    for (let i = 0; i < items.length; i += 1) {
      const current = items[i];
      const next = items[i + 1];
      const endAt = next?.changed_at || flowEndAt || null;
      map[current.id] = endAt ? formatDuration(current.changed_at, endAt) : "—";
    }
    return map;
  }, [assignmentTimeline, timeline]);

  const comprasStartAt = useMemo(() => {
    const statusInCompras = (timeline || []).find((evt) => Number(evt?.to_status_id || 0) === 12);
    return statusInCompras?.changed_at || reqMeta?.sent_on || reqMeta?.created_at || null;
  }, [timeline, reqMeta]);

  const assignmentWindowById = useMemo(() => {
    const windows = {};
    const items = [...(assignmentTimeline || [])].sort((a, b) => {
      const diff = toMs(a?.changed_at) - toMs(b?.changed_at);
      if (diff !== 0) return diff;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    const flowEndAt = timeline.length ? timeline[timeline.length - 1]?.changed_at || null : null;

    for (let i = 0; i < items.length; i += 1) {
      const evt = items[i];
      const next = items[i + 1];
      const startAt =
        i === 0 && evt?.previous_operator_id && comprasStartAt
          ? comprasStartAt
          : evt?.changed_at || null;
      const endAt = next?.changed_at || flowEndAt || null;
      windows[evt.id] = {
        startAt,
        endAt,
        inferredStart: Boolean(i === 0 && evt?.previous_operator_id && comprasStartAt),
        duration: startAt && endAt ? formatDuration(startAt, endAt) : assignmentDurationById[evt.id] || "—",
      };
    }
    return windows;
  }, [assignmentTimeline, timeline, comprasStartAt, assignmentDurationById]);

  const stepDates = useMemo(() => {
    const dates = {};
    if (reqMeta?.created_at) dates[7] = reqMeta.created_at;
    for (const evt of timeline) {
      const stepId = Number(evt?.to_status_id || 0);
      if (!STEP_FLOW.includes(stepId)) continue;
      if (!dates[stepId]) dates[stepId] = evt.changed_at;
    }
    return dates;
  }, [reqMeta, timeline]);

  const stepDateText = useMemo(() => {
    const out = {};
    STEP_FLOW.forEach((stepId, idx) => {
      const rawDate = stepDates[stepId];
      if (rawDate) {
        out[stepId] = fmt(rawDate);
        return;
      }
      const hasLaterStepDate = STEP_FLOW.slice(idx + 1).some((laterId) => Boolean(stepDates[laterId]));
      out[stepId] = hasLaterStepDate ? "No aplica" : "Pendiente";
    });
    return out;
  }, [stepDates]);

  const reachedIdx = useMemo(() => {
    const current = Number(reqMeta?.statuses_id || 0);
    const idx = STEP_FLOW.indexOf(current);
    return idx >= 0 ? idx : -1;
  }, [reqMeta]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/45" onClick={loading ? undefined : onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-800 font-bold">
              <Clock3 size={16} className="text-sky-700" />
              Progreso requisición #{requisitionId}
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-60 flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 max-h-[70vh] overflow-auto space-y-4">
            {loading ? (
              <div className="text-sm text-gray-500">Cargando progreso...</div>
            ) : (
              <>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase">
                    Progreso por etapas
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {STEP_FLOW.map((stepId, idx) => {
                      const reached = idx <= reachedIdx;
                      return (
                        <div
                          key={stepId}
                          className={`rounded-lg border p-3 ${
                            reached
                              ? "bg-sky-50 border-sky-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                reached ? "bg-sky-600" : "bg-gray-300"
                              }`}
                            />
                            <div
                              className={`text-[11px] font-bold uppercase ${
                                reached ? "text-sky-700" : "text-gray-500"
                              }`}
                            >
                              {STEP_LABELS[stepId]}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-800 mt-1">
                            {stepDateText[stepId]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 pb-4 text-[11px] text-gray-500">
                    "No aplica" indica que esa etapa se omitio por flujo. "Pendiente" indica que aun no se alcanza.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-gray-500">Enviada</div>
                    <div className="text-sm font-semibold text-gray-800 mt-1">{fmt(reqMeta?.sent_on)}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[11px] font-bold uppercase text-gray-500">Tiempo total</div>
                    <div className="text-sm font-semibold text-gray-800 mt-1">
                      {totalDays == null ? "—" : `${Math.ceil(totalDays)} día(s)`}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold text-gray-600 uppercase">Historial de cambios</div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => setHistoryFilter("all")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                            historyFilter === "all" ? "bg-sky-100 text-sky-800" : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter("status")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                            historyFilter === "status" ? "bg-sky-100 text-sky-800" : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Estatus
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryFilter("assignment")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                            historyFilter === "assignment" ? "bg-sky-100 text-sky-800" : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          Asignaciones
                        </button>
                      </div>
                      {inferred ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Fechas reconstruidas
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          Trazabilidad completa
                        </span>
                      )}
                    </div>
                  </div>
                  {filteredHistory.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">Aún no hay movimientos registrados.</div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {filteredHistory.map((evt, idx) => {
                        const isLast = idx === filteredHistory.length - 1;
                        const { fromLabel, toLabel } = transitionLabel(evt);
                        const prevOperator = String(evt?.previous_operator_name || "").trim() || "Sin asignar";
                        const nextOperator = String(evt?.new_operator_name || "").trim() || "Sin asignar";
                        const isAssignment = evt?.event_type === "assignment";
                        return (
                          <div key={evt.id} className="flex items-stretch gap-3">
                            <div className="w-4 flex flex-col items-center">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 mt-1" />
                              {!isLast && <span className="w-[2px] flex-1 bg-sky-100 mt-1" />}
                            </div>
                            <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3">
                              {isAssignment ? (
                                <>
                                  <div className="text-sm font-bold text-gray-800">Asignación actualizada</div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    De: <b>{prevOperator}</b> → A: <b>{nextOperator}</b>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {assignmentWindowById[evt.id]?.inferredStart ? (
                                      <span className="px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 text-[11px] font-semibold">
                                        Asignación inicial: {fmtDateTime(assignmentWindowById[evt.id]?.startAt)}
                                      </span>
                                    ) : null}
                                    <span className="px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                                      Reasignación: {fmtDateTime(evt.changed_at)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    Periodo:{" "}
                                    <b>{fmtDateTime(assignmentWindowById[evt.id]?.startAt)}</b>
                                    {"  "}→{"  "}
                                    <b>{fmtDateTime(assignmentWindowById[evt.id]?.endAt)}</b>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    Duración de asignación:{" "}
                                    <b>{assignmentWindowById[evt.id]?.duration || "—"}</b>
                                  </div>
                                  {assignmentWindowById[evt.id]?.inferredStart ? (
                                    <div className="text-[11px] text-gray-500 mt-1">
                                      Inicio inferido desde entrada a Compras para reflejar duración completa del operador previo.
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  <div className="text-sm font-bold text-gray-800">Estado actualizado a: {toLabel}</div>
                                  <div className="text-xs text-gray-600 mt-1">Venía de: {fromLabel}</div>
                                </>
                              )}
                              <div className="mt-1 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">
                                  {fmtDateTime(evt.changed_at)}
                                </span>
                                <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50">
                                  Realizado por: {actorLabel(evt)}
                                </span>
                              </div>
                              {evt.change_note ? (
                                <div className="text-xs text-gray-700 mt-2 bg-slate-50 border border-slate-200 rounded p-2">
                                  {evt.change_note}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
