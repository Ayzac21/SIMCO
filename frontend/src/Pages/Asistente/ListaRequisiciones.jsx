import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, X, FileText, Info, User, AlertTriangle, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";
import useEscapeKey from "../../hooks/useEscapeKey";
import RequisitionTimelineModal from "../../components/RequisitionTimelineModal";

const API = API_BASE_URL;

const STATUS_FLOW = [7, 8, 9, 12, 14, 13, 11];

const STATUS_LABELS = {
  7: "Borrador",
  8: "Coordinación",
  9: "Secretaría",
  12: "Cotización",
  14: "Revisión",
  13: "Compra",
  11: "Finalizada",
  10: "Rechazada",
};

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
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    return usuario?.id ? Number(usuario.id) : null;
  } catch {
    return null;
  }
}

function safeDate(d) {
  if (!d) return "—";
  try {
    return String(d).split("T")[0];
  } catch {
    return "—";
  }
}

function statusGuidance(statusId) {
  const st = Number(statusId);
  if (st === 7) return "Esta solicitud está en borrador. Puedes editarla y enviarla.";
  if (st === 8) return "La solicitud está en revisión de Coordinación.";
  if (st === 9) return "La solicitud está en revisión de Secretaría.";
  if (st === 10) return "La solicitud fue rechazada. Revisa el motivo para corregirla.";
  if (st === 12) return "Compras está cotizando con proveedores.";
  if (st === 13) return "La compra está en proceso. Solo queda esperar cierre.";
  if (st === 14) return "Compras está en revisión interna del comparativo.";
  if (st === 11) return "La compra ya finalizó. Esta solicitud está cerrada.";
  return "Revisa el detalle de la solicitud.";
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
      hint: "Puedes retomar y enviar tu requisición.",
      to: `/unidad/requisiciones/editar/${id}`,
    };
  }
  if (st === 14) {
    return {
      enabled: false,
      label: "Revisión interna de Compras",
      hint: "Compras Admin realiza la selección final.",
      to: null,
    };
  }
  if (st === 10) {
    return {
      enabled: false,
      label: "Rechazada",
      hint: "Consulta el motivo y crea/ajusta una nueva solicitud.",
      to: null,
    };
  }
  if (st === 11) {
    return {
      enabled: false,
      label: "Finalizada",
      hint: "Compra concluida. No requiere más acciones.",
      to: null,
    };
  }
  return {
    enabled: false,
    label: "Sin acciones pendientes",
    hint: "La solicitud sigue su flujo normal.",
    to: null,
  };
}

function emphasisByStatus(statusId) {
  const st = Number(statusId);
  if (st === 11) {
    return {
      panel: "border-emerald-200 bg-emerald-50",
      title: "text-emerald-700",
      text: "text-emerald-800",
      hint: "text-emerald-700",
    };
  }
  if (st === 10) {
    return {
      panel: "border-red-200 bg-red-50",
      title: "text-red-700",
      text: "text-red-800",
      hint: "text-red-700",
    };
  }
  return {
    panel: "border-gray-200 bg-gray-50",
    title: "text-gray-700",
    text: "text-gray-700",
    hint: "text-gray-500",
  };
}

function parseAdjustmentNote(rawNote) {
  const note = String(rawNote || "").trim();
  if (!note.startsWith("AJUSTE_")) return null;

  if (note.startsWith("AJUSTE_COORDINACION:")) {
    return {
      source: "Coordinación",
      message: note.replace("AJUSTE_COORDINACION:", "").trim(),
    };
  }
  if (note.startsWith("AJUSTE_SECRETARIA:")) {
    return {
      source: "Secretaría",
      message: note.replace("AJUSTE_SECRETARIA:", "").trim(),
    };
  }
  if (note.startsWith("AJUSTE_COMPRAS:")) {
    return {
      source: "Compras",
      message: note.replace("AJUSTE_COMPRAS:", "").trim(),
    };
  }
  return {
    source: "Área revisora",
    message: note.replace(/^AJUSTE_[A-Z_]+:\s*/i, "").trim(),
  };
}

function statusBadgeClasses(statusId) {
  const st = Number(statusId);
  if (st === 7) return "bg-orange-50 text-orange-800 border-orange-200";
  if (st === 8) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (st === 9) return "bg-blue-50 text-blue-700 border-blue-200";
  if (st === 12) return "bg-orange-50 text-orange-700 border-orange-200";
  if (st === 14) return "bg-gray-100 text-gray-700 border-gray-200";
  if (st === 13 || st === 11) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (st === 10) return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

/** ✅ Barra completa (para LISTA si quieres mantenerla ahí) */
const ProgressBar = ({ statusId }) => {
  const index = STATUS_FLOW.indexOf(Number(statusId));
  if (index === -1) return null;

  const pct = ((index + 1) / STATUS_FLOW.length) * 100;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[11px] font-medium text-gray-500">
        {STATUS_FLOW.map((id, i) => (
          <span
            key={id}
            className={i <= index ? "text-secundario font-semibold" : ""}
          >
            {STATUS_LABELS[id]}
          </span>
        ))}
      </div>

      <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
        <div
          className="h-2 bg-secundario rounded transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/** ✅ NUEVO: SOLO estatus actual + mini progreso (para MODAL) */
const CurrentStatus = ({ statusId, statusName }) => {
  const st = Number(statusId);
  const label = statusName || STATUS_LABELS[st] || "Sin estatus";

  // Si está en flujo, mostramos barrita; si no (p.ej. rechazada 10), no.
  const idx = STATUS_FLOW.indexOf(st);
  const hasFlow = idx !== -1;

  const pct = hasFlow ? Math.round(((idx + 1) / STATUS_FLOW.length) * 100) : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold bg-secundario/10 text-secundario border border-secundario/20">
          {label}
        </span>

        {hasFlow && (
          <span className="text-xs text-gray-500">
            Paso <b>{idx + 1}</b> de <b>{STATUS_FLOW.length}</b>
          </span>
        )}
      </div>

      {hasFlow && (
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full bg-secundario"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{pct}%</div>
        </div>
      )}
    </div>
  );
};

export default function ListaRequisiciones() {
  const navigate = useNavigate();
  const location = useLocation();

  const [requisiciones, setRequisiciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("new");

  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 6;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [partidaImagePreviews, setPartidaImagePreviews] = useState({});

  const [rejectedPreview, setRejectedPreview] = useState({}); // { [id]: { notes, rejected_by_name } }

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

  const fetchRequisiciones = async ({ showRefresh = false } = {}) => {
    const MIN_MS = 1200;
    const t0 = Date.now();
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      const userId = getUserId();
      if (!userId) throw new Error("No se encontró el usuario");

      const res = await fetch(
        `${API}/requisiciones/mis-requisiciones/${userId}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Error al cargar");

      const list = Array.isArray(data) ? data : [];
      setRequisiciones(list);
      setPaginaActual(1);

      // Precarga ligera para rechazadas (máx 8) para mostrar motivo en la lista
      const rejected = list.filter((r) => Number(r.statuses_id) === 10).slice(0, 8);
      if (rejected.length) {
        const entries = await Promise.all(
          rejected.map(async (r) => {
            try {
              const rr = await fetch(`${API}/requisiciones/${r.id}`, {
                headers: getAuthHeaders(),
              });
              const dd = await rr.json().catch(() => ({}));
              if (!rr.ok) return [r.id, null];
              return [
                r.id,
                {
                  notes: dd?.notes || "",
                  rejected_by_name: dd?.rejected_by_name || dd?.rejected_by || "",
                },
              ];
            } catch {
              return [r.id, null];
            }
          })
        );

        const map = {};
        entries.forEach(([id, val]) => {
          if (val) map[id] = val;
        });
        setRejectedPreview(map);
      } else {
        setRejectedPreview({});
      }
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar");
    } finally {
      const elapsed = Date.now() - t0;
      if (showRefresh && elapsed < MIN_MS) {
        await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
      }
      if (showRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisiciones({ showRefresh: false });
  }, []);

  const filtered = useMemo(() => {
    let list = [...requisiciones];

    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((r) => {
        const a = String(r.categoria || "").toLowerCase();
        const b = String(r.estatus || "").toLowerCase();
        const c = String(r.area_folio || "").toLowerCase();
        const d = String(r.id || "").toLowerCase();
        return a.includes(qq) || b.includes(qq) || c.includes(qq) || d.includes(qq);
      });
    }

    if (statusFilter !== "all") {
      const st = Number(statusFilter);
      list = list.filter((r) => Number(r.statuses_id) === st);
    }

    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime() || 0;
      const db = new Date(b.created_at).getTime() || 0;
      return sort === "new" ? db - da : da - db;
    });

    return list;
  }, [requisiciones, q, statusFilter, sort]);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / POR_PAGINA)),
    [filtered.length]
  );

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = inicio + POR_PAGINA;
  const page = filtered.slice(inicio, fin);

  const closeModal = () => {
    setTimelineOpen(false);
    setOpen(false);
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
    clearPartidaImagePreviews();
  };

  useEscapeKey(open, closeModal, detailLoading);

  const openModal = async (row) => {
    setSelected(row);
    setOpen(true);
    setDetail(null);

    try {
      setDetailLoading(true);
      const res = await fetch(`${API}/requisiciones/${row.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
      setDetail(data);
      await loadPartidaImagePreviews(row.id, data?.partidas || []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo abrir");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const openReq = Number(params.get("openReq") || 0);
    if (!openReq) return;
    if (!requisiciones.length) return;

    const row = requisiciones.find((r) => Number(r.id) === openReq);
    if (!row) return;

    openModal(row);
    navigate("/unidad/mi-requisiciones", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, requisiciones]);

  const continuar = () => {
    if (!selected) return;
    const action = actionConfigByStatus(selected.statuses_id, selected.id);
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

  useEffect(() => {
    return () => {
      revokePreviewUrls(partidaImagePreviews);
    };
  }, [partidaImagePreviews]);

  return (
    <div className="relative bg-white p-5 md:p-6 rounded-xl shadow-lg border border-gray-200">
      {refreshing && (
        <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <AppLoader label="Actualizando..." />
        </div>
      )}
      {/* ===== MODAL ===== */}
      {open && selected && (
        <div className="fixed inset-0 z-50">
          <RequisitionTimelineModal
            open={timelineOpen}
            requisitionId={selected?.id}
            onClose={() => setTimelineOpen(false)}
          />
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-secundario" size={18} />
                    <div className="font-extrabold text-gray-900 truncate">
                      {detail?.request_name || selected?.categoria || "Requisición"}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Folio: <b>#{selected.id}</b>{" "}
                    {selected.area_folio ? `• ${selected.area_folio}` : ""} •{" "}
                    {safeDate(selected.created_at)}
                  </div>

                  {/* ✅ AQUÍ: en MODAL ya NO mostramos todos los pasos */}
                  <CurrentStatus
                    statusId={selected.statuses_id}
                    statusName={selected.estatus}
                  />
                </div>

                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} className="text-gray-700" />
                </button>
              </div>

              <div className="p-5 space-y-4">
	                {detailLoading ? (
	                  <div className="text-sm text-gray-500">Cargando detalle...</div>
	                ) : (
	                  <>
	                    {(() => {
	                      const st = Number(selected.statuses_id);
	                      const adjustment = parseAdjustmentNote(detail?.notes);
	                      if (st !== 7 || !adjustment?.message) return null;
	                      return (
	                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
	                          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-800 uppercase">
	                            <AlertTriangle size={14} /> Ajuste solicitado por {adjustment.source}
	                          </div>
	                          <div className="text-sm text-amber-900 mt-2">
	                            {adjustment.message}
	                          </div>
	                          <div className="text-xs text-amber-800 mt-2">
	                            Edita esta requisición y vuelve a enviarla para continuar el proceso.
	                          </div>
	                        </div>
	                      );
	                    })()}

	                    {(() => {
	                      const emphasis = emphasisByStatus(selected.statuses_id);
	                      return (
                        <div className={`rounded-xl border p-4 ${emphasis.panel}`}>
                          <div className={`text-xs font-extrabold uppercase tracking-wide ${emphasis.title}`}>
                            Estado actual
                          </div>
                          <div className={`text-sm mt-1 ${emphasis.text}`}>
                            {statusGuidance(selected.statuses_id)}
                          </div>
                        </div>
                      );
                    })()}

                    {Number(selected.statuses_id) === 10 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-red-700">
                          <Info size={14} /> RECHAZADA
                        </div>
                        <div className="text-sm text-gray-800 mt-2">
                          <b>Motivo:</b>{" "}
                          {detail?.notes?.trim() ? (
                            detail.notes
                          ) : (
                            <span className="text-gray-600">No registrado</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-800 mt-1 flex items-center gap-2">
                          <User size={14} className="text-red-700" />
                          <b>Rechazó:</b>{" "}
                          {detail?.rejected_by_name?.trim() ? (
                            detail.rejected_by_name
                          ) : (
                            <span className="text-gray-600">No registrado</span>
                          )}
                        </div>
                      </div>
                    )}

                    {(detail?.partidas?.length ?? 0) > 0 ? (
                      <div className="border border-[#8B1D35]/20 rounded-xl overflow-hidden">
                        {/* ✅ Scroll interno para que no se aplaste */}
                        <div className="max-h-[260px] overflow-auto">
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
                              {detail.partidas.map((p) => (
                                <tr key={p.id}>
                                  <td className="px-4 py-3 font-semibold text-gray-800">
                                    {p.product_name || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {p.description || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                                    {p.quantity ?? "—"}
                                  </td>
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
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">Sin artículos.</div>
                    )}
                  </>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 flex items-center justify-between gap-3">
                {(() => {
                  const action = actionConfigByStatus(selected.statuses_id, selected.id);
                  const emphasis = emphasisByStatus(selected.statuses_id);
                  return (
                    <div className={`text-xs ${emphasis.hint}`}>
                      {action.hint}
                    </div>
                  );
                })()}
              </div>

              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                {(Number(selected.statuses_id) === 11 || canDownloadSignaturePdf(selected.statuses_id)) ? (
                  <div className="flex items-center gap-2">
                    {Number(selected.statuses_id) === 11 && (
                      <button
                        onClick={() => setTimelineOpen(true)}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        VER PROGRESO
                      </button>
                    )}
                    {canDownloadSignaturePdf(selected.statuses_id) && (
                      <button
                        onClick={() => downloadSignaturePdf(selected.id)}
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
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Cerrar
                </button>

                {(() => {
                  const action = actionConfigByStatus(selected.statuses_id, selected.id);
                  return (
                    <button
                      onClick={continuar}
                      disabled={!action.enabled}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm ${
                        action.enabled
                          ? "bg-secundario text-white hover:opacity-90"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-secundario">
            Mis requisiciones
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Filtra y abre una solicitud para ver su avance.
          </p>
        </div>

        <button
          onClick={() => fetchRequisiciones({ showRefresh: true })}
          disabled={refreshing || loading}
          className={`px-4 py-2 bg-secundario text-white rounded-lg hover:opacity-90 text-sm font-semibold inline-flex items-center gap-2 ${
            refreshing || loading ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (folio, categoría, estatus)..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-secundario/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="all">Todos</option>
          <option value="7">Borrador</option>
          <option value="8">Coordinación</option>
          <option value="9">Secretaría</option>
          <option value="12">Cotización</option>
          <option value="14">Revisión</option>
          <option value="13">Compra</option>
          <option value="11">Finalizada</option>
          <option value="10">Rechazada</option>
        </select>

        <button
          onClick={() => setSort((p) => (p === "new" ? "old" : "new"))}
          className="px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
          title="Cambiar orden"
        >
          <ArrowUpDown size={16} className="text-gray-500" />
          {sort === "new" ? "Más recientes" : "Más antiguas"}
        </button>
      </div>

      {/* ===== LISTA ===== */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
          <div className="col-span-7">Solicitud</div>
          <div className="col-span-3">Estatus</div>
          <div className="col-span-2 text-right">Fecha</div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Cargando...</div>
        ) : page.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No hay requisiciones.
          </div>
        ) : (
          <div className="divide-y">
            {page.map((req) => {
              const st = Number(req.statuses_id);
              const preview = st === 10 ? rejectedPreview[req.id] : null;
              const motivo = preview?.notes?.trim() ? preview.notes.trim() : "";
              const quien = preview?.rejected_by_name?.trim()
                ? preview.rejected_by_name.trim()
                : "";

              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => openModal(req)}
                  className="w-full text-left px-4 py-4 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-secundario/20"
                >
                  <div className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-7 min-w-0">
                      <div className="font-bold text-secundario truncate text-[15px]">
                        {req.categoria}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Folio: <b>#{req.id}</b>{" "}
                        {req.area_folio ? `• ${req.area_folio}` : ""}
                      </div>

                      {/* (Dejé tu barra completa aquí porque dijiste que te gusta en la lista) */}
                      <div className="mt-2">
                        <ProgressBar statusId={st} />
                      </div>

                      {st === 10 && (
                        <div className="mt-2 text-sm text-gray-700">
                          <span className="font-semibold text-red-700">
                            Motivo:
                          </span>{" "}
                          {motivo ? (
                            <span className="text-gray-800">{motivo}</span>
                          ) : (
                            <span className="text-gray-500">No registrado</span>
                          )}
                          <span className="text-gray-400"> • </span>
                          <span className="font-semibold text-red-700">
                            Rechazó:
                          </span>{" "}
                          {quien ? (
                            <span className="text-gray-800">{quien}</span>
                          ) : (
                            <span className="text-gray-500">No registrado</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="col-span-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                        Estatus
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${statusBadgeClasses(st)}`}
                      >
                        {req.estatus || STATUS_LABELS[st] || "Sin estatus"}
                      </span>

                    </div>

                    <div className="col-span-2 text-right text-sm text-gray-700">
                      {safeDate(req.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== PAGINACIÓN ===== */}
      <div className="mt-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button
            onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
            disabled={paginaActual === 1}
            className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          <span className="text-sm text-gray-600 text-center">
            Página <b>{paginaActual}</b> de <b>{totalPaginas}</b>
          </span>

          <button
            onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas}
            className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
