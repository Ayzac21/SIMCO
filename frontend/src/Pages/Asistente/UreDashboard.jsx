import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Clock3, CheckCircle2, XCircle, ArrowRight, X, User, Info, RefreshCw, Download } from "lucide-react";
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";
import useEscapeKey from "../../hooks/useEscapeKey";
import RequisitionTimelineModal from "../../components/RequisitionTimelineModal";

const API = API_BASE_URL;
const PRIMARY = "#8B1D35";
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

function getUserId() {
  try {
    const direct = localStorage.getItem("users_id");
    if (direct) return Number(direct);

    const userStr = localStorage.getItem("usuario");
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u?.id) return Number(u.id);
      if (u?.users_id) return Number(u.users_id);
    }
  } catch {
    return null;
  }
  return null;
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function badgeByStatus(statusId, statusName) {
  let cls = "bg-gray-100 text-gray-700 border-gray-200";

  switch (Number(statusId)) {
    case 7:
      cls = "bg-orange-50 text-orange-800 border-orange-200";
      break;
    case 8:
      cls = "bg-yellow-50 text-yellow-700 border-yellow-200";
      break;
    case 9:
      cls = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case 10:
      cls = "bg-red-50 text-red-700 border-red-200";
      break;
    case 12:
      cls = "bg-orange-50 text-orange-700 border-orange-200";
      break;
    case 11:
    case 13:
      cls = "bg-secundario/10 text-secundario border-secundario/20";
      break;
    case 14:
      cls = "bg-gray-100 text-gray-700 border-gray-200";
      break;
    default:
      break;
  }

  return { text: statusName || "Sin estatus", cls };
}

function nextStepText(statusId) {
  const st = Number(statusId);
  if (st === 7) return "Te falta enviar esta solicitud.";
  if (st === 14) return "Compras está en revisión interna del comparativo.";
  if (st === 10) return "Fue rechazada. Revisa las notas.";
  if (st === 13) return "Compras ya está haciendo el pedido.";
  if (st === 11) return "Listo: ya fue comprada.";
  if (st === 8) return "Está en Coordinación.";
  if (st === 9) return "Está en Secretaría.";
  if (st === 12) return "Compras está cotizando.";
  return "Revisa el detalle.";
}

function canDownloadSignaturePdf(statusId) {
  return [12, 13, 14].includes(Number(statusId));
}

function actionConfigByStatus(statusId, id) {
  const st = Number(statusId);
  if (st === 7) {
    return {
      enabled: true,
      label: "Editar borrador",
      hint: "Puedes retomar y enviar la requisición.",
      to: `/unidad/requisiciones/editar/${id}`,
    };
  }
  if (st === 14) {
    return {
      enabled: false,
      label: "Revisión interna de Compras",
      hint: "La selección de proveedor la realiza Compras Admin.",
      to: null,
    };
  }
  if (st === 11) {
    return {
      enabled: false,
      label: "Finalizada",
      hint: "La compra ya se completó. No hay acciones pendientes.",
      to: null,
    };
  }
  if (st === 10) {
    return {
      enabled: false,
      label: "Rechazada",
      hint: "Revisa el motivo para volver a capturar o ajustar.",
      to: null,
    };
  }
  return {
    enabled: false,
    label: "Sin acciones pendientes",
    hint: "La solicitud sigue su proceso interno.",
    to: null,
  };
}

function emphasisByStatus(statusId) {
  const st = Number(statusId);
  if (st === 11) {
    return {
      hint: "text-emerald-700",
      marker: "bg-emerald-50 border-emerald-200 text-emerald-700",
    };
  }
  if (st === 10) {
    return {
      hint: "text-red-700",
      marker: "bg-red-50 border-red-200 text-red-700",
    };
  }
  return {
    hint: "text-gray-500",
    marker: "bg-gray-100 border-gray-200 text-gray-700",
  };
}

export default function UreDashboard() {
  const navigate = useNavigate();
  const usersId = useMemo(() => getUserId(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState({
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    total: 0,
  });

  const [needsAction, setNeedsAction] = useState({ borradores: 0 });
  const [latest, setLatest] = useState([]);

  const [open, setOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [partidaImagePreviews, setPartidaImagePreviews] = useState({});

  const revokePreviewUrls = (map) => {
    Object.values(map || {}).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  };

  const clearPartidaImagePreviews = () => {
    setPartidaImagePreviews((prev) => {
      revokePreviewUrls(prev);
      return {};
    });
  };

  const loadPartidaImagePreviews = async (reqId, partidas = []) => {
    const validPartidas = (partidas || []).filter(
      (p) =>
        p?.id &&
        (p?.image_original_name || p?.image_mime_type || Number(p?.image_size_bytes || 0) > 0)
    );

    if (!validPartidas.length) {
      clearPartidaImagePreviews();
      return;
    }

    const entries = await Promise.all(
      validPartidas.map(async (p) => {
        try {
          const resp = await fetch(`${API}/requisiciones/${reqId}/partidas/${p.id}/image`, {
            headers: getAuthHeaders(),
          });
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          return [String(p.id), url];
        } catch {
          return null;
        }
      })
    );

    const nextMap = {};
    entries.filter(Boolean).forEach(([id, url]) => {
      nextMap[id] = url;
    });

    setPartidaImagePreviews((prev) => {
      revokePreviewUrls(prev);
      return nextMap;
    });
  };

  const loadDashboard = async ({ showRefresh = false } = {}) => {
    if (!usersId) {
      setLoading(false);
      toast.error("Sesión no válida. Vuelve a iniciar sesión.");
      return;
    }
    const MIN_MS = 1200;
    const t0 = Date.now();
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const [statsRes, listRes] = await Promise.all([
        fetch(`${API}/requisiciones/dashboard/${usersId}/stats`, { headers: getAuthHeaders() }),
        fetch(`${API}/requisiciones/mis-requisiciones/${usersId}`, { headers: getAuthHeaders() }),
      ]);

      const statsData = await statsRes.json().catch(() => ({}));
      const listData = await listRes.json().catch(() => ([]));

      if (!statsRes.ok || !statsData?.ok) {
        throw new Error(statsData?.message || "No se pudo cargar stats");
      }

      const reqs = Array.isArray(listData) ? listData : [];

      const borradores = reqs.filter((r) => Number(r.statuses_id) === 7).length;

      setSummary({
        pendientes: Number(statsData.pendientes || 0),
        aprobadas: Number(statsData.aprobadas || 0),
        rechazadas: Number(statsData.rechazadas || 0),
        total: Number(statsData.total || 0),
      });

      setNeedsAction({ borradores });

      setLatest(reqs.slice(0, 5));
    } catch (e) {
      console.error(e);
      toast.error("Error cargando dashboard");
    } finally {
      const elapsed = Date.now() - t0;
      if (showRefresh && elapsed < MIN_MS) {
        await sleep(MIN_MS - elapsed);
      }
      if (showRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard({ showRefresh: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setTimelineOpen(false);
    setOpen(false);
    setSelectedRow(null);
    setDetail(null);
    setDetailLoading(false);
    clearPartidaImagePreviews();
  };

  useEscapeKey(open, closeModal, detailLoading);

  const openModal = async (row) => {
    setSelectedRow(row);
    setDetail(null);
    setOpen(true);

    try {
      setDetailLoading(true);

      const resp = await fetch(`${API}/requisiciones/${row.id}`, { headers: getAuthHeaders() });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) throw new Error(data?.message || "No se pudo cargar la requisición");
      setDetail(data);
      await loadPartidaImagePreviews(row.id, data?.partidas || []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo abrir la requisición");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      revokePreviewUrls(partidaImagePreviews);
    };
  }, [partidaImagePreviews]);

  const continuar = () => {
    if (!selectedRow) return;
    const action = actionConfigByStatus(selectedRow.statuses_id, selectedRow.id);
    if (!action.enabled || !action.to) return;
    closeModal();
    navigate(action.to);
  };

  const downloadSignaturePdf = async (reqId) => {
    try {
      const res = await fetch(`${API}/requisiciones/${reqId}/pdf-firma`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo generar el PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e?.message || "No se pudo descargar el PDF");
    }
  };

  const StatCard = ({ label, value, icon, iconBg, helper }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900">{loading ? "—" : value}</p>
        {helper ? <p className="text-xs text-gray-500 mt-1">{helper}</p> : null}
      </div>
      <div className={`p-3 rounded-full ${iconBg}`}>{icon}</div>
    </div>
  );

  return (
    <div className="relative space-y-6">
      {refreshing && (
        <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <AppLoader label="Actualizando..." />
        </div>
      )}
      {open && selectedRow && (
        <div className="fixed inset-0 z-50">
          <RequisitionTimelineModal
            open={timelineOpen}
            requisitionId={selectedRow?.id}
            onClose={() => setTimelineOpen(false)}
          />
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-[#8B1D35]" size={18} />
                    <div className="font-extrabold text-gray-900 truncate">
                      {detail?.request_name || selectedRow?.categoria || "Requisición"}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Folio: <span className="font-extrabold text-gray-800">#{selectedRow.id}</span> •{" "}
                    <span className="font-extrabold text-gray-800">{selectedRow.area_folio}</span> •{" "}
                    {selectedRow.categoria}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const b = badgeByStatus(selectedRow.statuses_id, selectedRow.estatus);
                      return (
                        <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-extrabold border ${b.cls} inline-flex items-center gap-1`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                          {b.text}
                        </span>
                      );
                    })()}

                    {(() => {
                      const em = emphasisByStatus(selectedRow.statuses_id);
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded border ${em.marker}`}>
                          {nextStepText(selectedRow.statuses_id)}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  title="Cerrar"
                >
                  <X size={18} className="text-gray-700" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {detailLoading ? (
                  <div className="text-sm text-gray-500">Cargando detalle...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-blue-700">
                          <User size={14} /> SOLICITANTE
                        </div>
                        <div className="text-sm font-extrabold text-gray-900 mt-1">
                          {detail?.solicitante?.trim() ? detail.solicitante : "—"}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">{detail?.ure?.trim() ? detail.ure : ""}</div>
                      </div>

                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-red-700">
                          <Info size={14} /> NOTAS
                        </div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.notes?.trim() ? detail.notes : <span className="text-gray-600">Sin notas</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="text-xs font-extrabold text-indigo-700">JUSTIFICACIÓN</div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.justification?.trim() ? detail.justification : <span className="text-gray-600">Sin justificación</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-extrabold text-amber-700">OBSERVACIONES</div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.observation?.trim() ? detail.observation : <span className="text-gray-600">Sin observaciones</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-extrabold text-gray-800 uppercase tracking-wide mb-2">Lista de artículos</div>

                      <div className="border border-[#8B1D35]/20 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-[#6F152B] bg-[#8B1D35]/[0.08]">
                            <tr>
                              <th className="text-left px-4 py-3">Producto</th>
                              <th className="text-left px-4 py-3">Descripción</th>
                              <th className="text-right px-4 py-3">Cant.</th>
                              <th className="text-center px-4 py-3">Img</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(detail?.partidas || []).map((p) => (
                              <tr key={p.id}>
                                <td className="px-4 py-3 font-semibold text-gray-900">{p.product_name || "—"}</td>
                                <td className="px-4 py-3 text-gray-700">{p.description || "—"}</td>
                                <td className="px-4 py-3 text-right font-extrabold text-gray-900">{p.quantity ?? "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  {partidaImagePreviews[String(p.id)] ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        window.open(
                                          partidaImagePreviews[String(p.id)],
                                          "_blank",
                                          "noopener,noreferrer"
                                        )
                                      }
                                      className="h-11 w-11 rounded border border-[#8B1D35]/20 overflow-hidden inline-flex"
                                      title="Abrir imagen"
                                    >
                                      <img
                                        src={partidaImagePreviews[String(p.id)]}
                                        alt={`Imagen partida ${p.id}`}
                                        className="h-full w-full object-cover"
                                      />
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}

                            {(!detail?.partidas || detail.partidas.length === 0) && (
                              <tr>
                                <td className="px-4 py-5 text-center text-gray-500" colSpan={4}>
                                  No hay artículos.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 flex items-center justify-between gap-3">
                {(() => {
                  const action = actionConfigByStatus(selectedRow.statuses_id, selectedRow.id);
                  const em = emphasisByStatus(selectedRow.statuses_id);
                  return <div className={`text-xs ${em.hint}`}>{action.hint}</div>;
                })()}
              </div>

              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                {(Number(selectedRow.statuses_id) === 11 || canDownloadSignaturePdf(selectedRow.statuses_id)) ? (
                  <div className="flex items-center gap-2">
                    {Number(selectedRow.statuses_id) === 11 && (
                      <button
                        onClick={() => setTimelineOpen(true)}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        VER PROGRESO
                      </button>
                    )}
                    {canDownloadSignaturePdf(selectedRow.statuses_id) && (
                      <button
                        onClick={() => downloadSignaturePdf(selectedRow.id)}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white border border-secundario/30 text-secundario hover:bg-secundario/10 inline-flex items-center gap-1"
                      >
                        <Download size={14} />
                        PDF para firmas
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-900">
                  Cerrar
                </button>

                {(() => {
                  const action = actionConfigByStatus(selectedRow.statuses_id, selectedRow.id);
                  return (
                    <button
                      onClick={continuar}
                      disabled={!action.enabled}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm inline-flex items-center gap-1 ${
                        action.enabled
                          ? "text-white hover:opacity-90"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                      style={action.enabled ? { backgroundColor: PRIMARY } : undefined}
                    >
                      {action.label}
                      {action.enabled ? <ArrowRight size={14} /> : null}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
            Tus solicitudes
          </h1>
          <p className="text-gray-700 mt-1">Aquí puedes ver tus solicitudes y continuar donde te quedaste.</p>
        </div>

        <button
          onClick={() => loadDashboard({ showRefresh: true })}
          disabled={refreshing || loading}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm inline-flex items-center gap-2 ${
            refreshing || loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
          style={{ backgroundColor: PRIMARY }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="En trámite" value={summary.pendientes} helper="Aún no finalizadas" iconBg="bg-yellow-50" icon={<Clock3 className="w-6 h-6 text-yellow-600" />} />
        <StatCard label="Listas" value={summary.aprobadas} helper="Ya avanzaron / completadas" iconBg="bg-blue-50" icon={<CheckCircle2 className="w-6 h-6 text-blue-600" />} />
        <StatCard label="Rechazadas" value={summary.rechazadas} helper="Revisa notas" iconBg="bg-gray-100" icon={<XCircle className="w-6 h-6 text-gray-500" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button onClick={() => navigate("/unidad/mi-requisiciones")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:bg-gray-50 transition">
          <div className="text-sm font-extrabold text-gray-900">Borradores</div>
          <div className="text-xs text-gray-500 mt-1">Edita y envía lo que quedó pendiente.</div>
          <div className="mt-3 text-2xl font-extrabold text-gray-900">{loading ? "—" : needsAction.borradores}</div>
        </button>

        <button onClick={() => navigate("/unidad/requisiciones/nueva")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:bg-gray-50 transition">
          <div className="text-sm font-extrabold text-gray-900">Nueva requisición</div>
          <div className="text-xs text-gray-500 mt-1">Crea una solicitud nueva y guárdala en borrador cuando quieras.</div>
          <div className="mt-3 text-sm font-extrabold text-secundario">Ir a crear →</div>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={18} className="text-gray-400" /> Actividad Reciente
          </h3>
          <button onClick={() => navigate("/unidad/mi-requisiciones")} className="text-xs font-extrabold hover:underline" style={{ color: PRIMARY }}>
            VER TODO
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan="2" className="p-5 text-center text-sm text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}

              {!loading && latest.length === 0 && (
                <tr>
                  <td colSpan="2" className="p-5 text-center text-sm text-gray-400">
                    Sin actividad reciente
                  </td>
                </tr>
              )}

              {!loading &&
                latest.map((req) => {
                  const b = badgeByStatus(req.statuses_id, req.estatus);
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openModal(req)}
                      title="Clic para ver"
                    >
                      <td className="px-5 py-4 w-[90px] align-top">
                        <span className="font-extrabold text-gray-800 text-sm">#{req.id}</span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{req.categoria}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {req.area_folio} • {fmtDate(req.created_at)}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">{nextStepText(req.statuses_id)}</div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-extrabold border ${b.cls} inline-flex items-center gap-1`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                              {b.text}
                            </span>

                            <span className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-400" aria-hidden="true">
                              <ArrowRight size={16} />
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
