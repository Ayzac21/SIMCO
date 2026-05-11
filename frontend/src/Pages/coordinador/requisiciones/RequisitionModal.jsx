import React, { useEffect, useState } from "react";
import {
    X,
    CheckCircle,
    XCircle,
    FileText,
    Download,
    User,
    AlertTriangle,
    MessageSquare,
    Info,
} from "lucide-react";
import { toast } from "sonner";
import useEscapeKey from "../../../hooks/useEscapeKey";
import RequisitionTimelineModal from "../../../components/RequisitionTimelineModal";
import { getAuthHeaders } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";
import { getRequisitionUnitLabel } from "../../../utils/unitDisplay";
import { getStatusLabel } from "../../../utils/statusDisplay";

// ✅ Loader doble (tu diseño)
const DoubleSpinner = ({ label = "Cargando..." }) => (
  <div className="flex-col gap-4 w-full flex items-center justify-center py-8">
    <div className="w-20 h-20 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
      <div className="w-16 h-16 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
    </div>
    <div className="text-xs text-gray-500 mt-2">{label}</div>
  </div>
);

const API = API_BASE_URL;

export default function RequisitionModal({
  req,
  items,
  loadingItems,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
  onEditDraft,
  onSendDraft,
  onDownloadSignaturePdf,
}) {
  const [actionMode, setActionMode] = useState(null); // reject | adjust | null
  const [reason, setReason] = useState("");
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [itemImagePreviews, setItemImagePreviews] = useState({});

  useEscapeKey(Boolean(req), () => {
    if (!loadingItems) onClose?.();
  }, loadingItems);

  // ✅ Cuando cambia el req (abriste otro), reseteamos rechazo
  useEffect(() => {
    setActionMode(null);
    setReason("");
    setTimelineOpen(false);
    setItemImagePreviews((prev) => {
      Object.values(prev).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {};
    });
  }, [req?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadItemImages = async () => {
      const validItems = (items || []).filter((item) => item?.id);

      if (!req?.id || !validItems.length) {
        setItemImagePreviews((prev) => {
          Object.values(prev).forEach((url) => {
            if (url) URL.revokeObjectURL(url);
          });
          return {};
        });
        return;
      }

      const loadedEntries = await Promise.all(
        validItems.map(async (item) => {
          try {
            const resp = await fetch(
              `${API}/coordinador/requisiciones/${req.id}/items/${item.id}/image`,
              { headers: getAuthHeaders() }
            );
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            return [String(item.id), url];
          } catch {
            return null;
          }
        })
      );

      if (cancelled) {
        loadedEntries.forEach((entry) => {
          if (entry?.[1]) URL.revokeObjectURL(entry[1]);
        });
        return;
      }

      const nextMap = {};
      loadedEntries.filter(Boolean).forEach(([key, url]) => {
        nextMap[key] = url;
      });

      setItemImagePreviews((prev) => {
        Object.values(prev).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
        return nextMap;
      });
    };

    loadItemImages();

    return () => {
      cancelled = true;
    };
  }, [items, req?.id]);

  if (!req) return null;
  const statusId = Number(req.statuses_id);
  const authUserId = Number(localStorage.getItem("users_id") || 0);
  const isOwnerCoordinatorReq = Number(req.users_id || 0) === authUserId;
  const canEditInCoordination = statusId === 8 && isOwnerCoordinatorReq;
  const isPurchasedStatus = statusId === 11;
  const canDownloadSignaturePdf = [12, 13, 14].includes(statusId) && !isPurchasedStatus;
  const isAdjustMode = actionMode === "adjust";

  const notesText = String(req.notes || "");
  const secretariaHistoryNote = String(req.secretaria_adjustment_note || "");
  const effectiveNotesText =
    notesText.trim() || secretariaHistoryNote.trim() || "";
  const noteIsAdjustment =
    effectiveNotesText.startsWith("AJUSTE_COORDINACION:") ||
    effectiveNotesText.startsWith("AJUSTE_SECRETARIA:");
  const adjustmentSource = effectiveNotesText.startsWith("AJUSTE_SECRETARIA:")
    ? "Secretaría"
    : effectiveNotesText.startsWith("AJUSTE_COORDINACION:")
    ? "Coordinación"
    : "";
  const readableNote = noteIsAdjustment
    ? effectiveNotesText.replace(/^AJUSTE_(COORDINACION|SECRETARIA):\s*/i, "")
    : effectiveNotesText;

  const statusTone = (() => {
    if (statusId === 8) return "bg-yellow-50 text-yellow-800 border-yellow-200";
    if (statusId === 9) return "bg-blue-50 text-blue-800 border-blue-200";
    if (statusId === 10) return "bg-red-50 text-red-800 border-red-200";
    if (statusId === 12) return "bg-orange-50 text-orange-800 border-orange-200";
    if (statusId === 13) return "bg-indigo-50 text-indigo-800 border-indigo-200";
    if (statusId === 14) return "bg-slate-100 text-slate-800 border-slate-300";
    if (statusId === 11) return "bg-emerald-50 text-emerald-800 border-emerald-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  })();

  const handleConfirmAction = () => {
    if (!reason.trim()) {
      toast.warning("Falta información");
      return;
    }
    if (actionMode === "reject") onReject(req, reason);
    if (actionMode === "adjust") onRequestChanges?.(req, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <RequisitionTimelineModal
        open={timelineOpen}
        requisitionId={req?.id}
        onClose={() => setTimelineOpen(false)}
      />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[94vw] lg:max-w-3xl xl:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 truncate">
              <FileText className="text-principal shrink-0" />
              <span className="truncate">{req.request_name}</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Folio: #{req.id} • {getRequisitionUnitLabel(req, "Unidad solicitante")}
            </p>
            <span className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusTone}`}>
              {getStatusLabel(req.statuses_id, req.nombre_estatus || req.estatus)}
            </span>
          </div>

          {/* ✅ opcional: evitar cerrar mientras carga */}
          <div className="flex items-center gap-2">
            {canDownloadSignaturePdf && (
              <button
                onClick={() => onDownloadSignaturePdf?.(req.id)}
                className="px-3 py-2 text-[11px] font-bold rounded-lg border bg-white text-secundario border-secundario/30 hover:bg-secundario/10 inline-flex items-center gap-1"
                disabled={loadingItems}
              >
                <Download size={14} />
                PDF para firmas
              </button>
            )}
            {statusId === 11 && (
              <button
                onClick={() => setTimelineOpen(true)}
                className="px-3 py-2 text-[11px] font-bold rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                VER PROGRESO
              </button>
            )}
            <button
              onClick={loadingItems ? undefined : onClose}
              className={`p-2 rounded-full transition ${
                loadingItems
                  ? "text-gray-300 cursor-not-allowed"
                  : "hover:bg-gray-200 text-gray-500"
              }`}
              title={loadingItems ? "Cargando..." : "Cerrar"}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {actionMode ? (
            <div
              className={`p-6 rounded-xl border ${
                isAdjustMode ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-100"
              }`}
            >
              <div
                className={`flex items-center gap-2 font-bold mb-2 ${
                  isAdjustMode ? "text-amber-800" : "text-red-700"
                }`}
              >
                <AlertTriangle size={20} />
                {isAdjustMode ? "Solicitar ajustes de la requisición" : "Motivo del rechazo"}
              </div>
              <p className={`text-xs mb-3 ${isAdjustMode ? "text-amber-700" : "text-red-600"}`}>
                {isAdjustMode
                  ? "Describe de forma clara qué debe corregir el solicitante para poder continuar el proceso."
                  : "Especifica por qué se rechaza la requisición."}
              </p>
              <textarea
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white text-sm ${
                  isAdjustMode
                    ? "border-amber-300 focus:ring-2 focus:ring-amber-200"
                    : "border-red-300 focus:ring-2 focus:ring-red-200"
                }`}
                rows="4"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
                placeholder={
                  isAdjustMode
                    ? "Ejemplo: agrega especificaciones técnicas en la partida 2 y corrige la cantidad de la partida 4."
                    : "Escribe el motivo del rechazo..."
                }
              />
            </div>
          ) : (
            <>
              {/* Datos del Solicitante */}
              <div className="flex items-start gap-4 p-4 bg-principal/10 rounded-xl border border-principal/25">
                <div className="p-2 bg-white rounded-full shadow-sm">
                  <User className="text-principal" size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-principal uppercase">
                    Solicitante
                  </p>
                  <p className="font-semibold text-gray-800">{req.solicitante}</p>
                  <p className="text-sm text-gray-600">{getRequisitionUnitLabel(req, "Unidad solicitante")}</p>
                </div>
              </div>

              {/* Motivo de rechazo previo */}
              {readableNote && (
                <div
                  className={`rounded-lg p-3 flex gap-3 border ${
                    noteIsAdjustment
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {noteIsAdjustment ? (
                    <AlertTriangle className="text-amber-700 shrink-0 mt-1" size={18} />
                  ) : (
                    <Info className="text-slate-600 shrink-0 mt-1" size={18} />
                  )}
                  <div>
                    <p
                      className={`text-xs font-bold uppercase mb-1 ${
                        noteIsAdjustment ? "text-amber-800" : "text-slate-700"
                      }`}
                    >
                      {noteIsAdjustment
                        ? `Ajustes solicitados${adjustmentSource ? ` por ${adjustmentSource}` : ""}`
                        : "Motivo / Notas"}
                    </p>
                    <p className="text-sm text-gray-800 font-medium leading-snug">
                      "{readableNote}"
                    </p>
                  </div>
                </div>
              )}

              {/* Justificación y Observaciones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {req.justification && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex gap-3">
                    <Info className="text-sky-700 shrink-0 mt-1" size={18} />
                    <div>
                      <p className="text-xs font-bold text-sky-700 uppercase mb-1">
                        Justificación
                      </p>
                      <p className="text-sm text-gray-700 leading-snug">
                        "{req.justification}"
                      </p>
                    </div>
                  </div>
                )}
                {req.observation && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-3">
                    <MessageSquare
                      className="text-slate-600 shrink-0 mt-1"
                      size={18}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase mb-1">
                        Observaciones
                      </p>
                      <p className="text-sm text-gray-700 italic leading-snug">
                        "{req.observation}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabla de Artículos */}
              <div>
                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">
                  Lista de Artículos
                </h3>

                <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[140px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 w-[20%]">Producto</th>
                        <th className="px-3 py-2 w-[56%]">Descripción</th>
                        <th className="px-3 py-2 text-center w-14">Cant.</th>
                        <th className="px-3 py-2 w-20">Unidad</th>
                        <th className="px-3 py-2 text-center w-20">Imagen</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {loadingItems ? (
                        <tr>
                          <td colSpan="5" className="p-0">
                            <DoubleSpinner label="Cargando artículos..." />
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-gray-400">
                            No hay artículos
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-3 font-medium text-gray-800">
                              {item.product_name ||
                                item.name ||
                                item.producto ||
                                "—"}
                            </td>
                            <td className="px-3 py-3 text-gray-600 leading-snug">
                              {item.description || item.concept || item.descripcion || "—"}
                            </td>
                            <td className="px-3 py-3 font-bold text-center bg-gray-50/50">
                              {item.quantity || item.cantidad || 0}
                            </td>
                            <td className="px-3 py-3 text-gray-600 font-medium">
                              {item.nombre_unidad || item.unit || "-"}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {itemImagePreviews[String(item.id)] ? (
                                <button
                                  type="button"
                                  className="h-16 w-16 rounded border border-gray-200 overflow-hidden inline-flex"
                                  onClick={() =>
                                    window.open(
                                      itemImagePreviews[String(item.id)],
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                  title="Abrir imagen"
                                >
                                  <img
                                    src={itemImagePreviews[String(item.id)]}
                                    alt={`Imagen partida ${idx + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          {statusId === 7 ? (
            <>
              <button
                onClick={() => onEditDraft?.(req)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60"
                disabled={loadingItems}
              >
                Editar borrador
              </button>
              <button
                onClick={() => onSendDraft?.(req)}
                className="px-4 py-2 bg-principal hover:opacity-90 text-white rounded-lg shadow-md transition-colors disabled:opacity-60"
                disabled={loadingItems}
              >
                Enviar a Secretaría
              </button>
            </>
          ) : statusId !== 8 ? (
            <div
              className={`w-full text-center font-bold py-3 rounded-lg flex items-center justify-center gap-2
                ${
                  statusId === 10
                    ? "bg-red-100 text-red-700"
                    : statusId === 9
                    ? "bg-blue-100 text-blue-800"
                    : statusId === 12
                    ? "bg-orange-100 text-orange-800"
                    : statusId === 13
                    ? "bg-indigo-100 text-indigo-800"
                    : statusId === 11
                    ? "bg-emerald-100 text-emerald-800"
                    : statusId === 14
                    ? "bg-slate-200 text-slate-800"
                    : "bg-slate-100 text-slate-700"
                }`}
            >
              {statusId === 10 ? (
                <>
                  <XCircle size={20} /> Esta solicitud fue RECHAZADA
                </>
              ) : statusId === 9 ? (
                <>
                  <CheckCircle size={20} /> Esta solicitud fue enviada a SECRETARÍA para revisión
                </>
              ) : statusId === 12 ? (
                <>
                  <Info size={20} /> Esta solicitud está en COTIZACIÓN en Compras
                </>
              ) : statusId === 13 ? (
                <>
                  <Info size={20} /> Esta solicitud está en PROCESO DE COMPRA
                </>
              ) : statusId === 11 ? (
                <>
                  <CheckCircle size={20} /> Esta solicitud ya fue COMPRADA y FINALIZADA
                </>
              ) : statusId === 14 ? (
                <>
                  <Info size={20} /> Esta solicitud está en REVISIÓN DE COTIZACIONES
                </>
              ) : (
                <>
                  <Info size={20} /> Esta solicitud continúa en proceso
                </>
              )}
            </div>
          ) : (
            <>
              {actionMode ? (
                <>
                  <button
                    onClick={() => setActionMode(null)}
                    className="px-4 py-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                    disabled={loadingItems}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className={`px-4 py-2 text-white rounded-lg shadow-md transition-colors disabled:opacity-60 ${
                      isAdjustMode
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    disabled={loadingItems}
                  >
                    {isAdjustMode ? "Enviar solicitud de ajustes" : "Confirmar rechazo"}
                  </button>
                </>
              ) : (
                <>
                  {canEditInCoordination && (
                    <button
                      onClick={() => onEditDraft?.(req)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-60"
                      disabled={loadingItems}
                    >
                      Editar requisición
                    </button>
                  )}
                  <button
                    onClick={() => setActionMode("adjust")}
                    className="px-4 py-2 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg flex gap-2 items-center transition-colors disabled:opacity-60"
                    disabled={loadingItems}
                  >
                    <AlertTriangle size={18} /> Solicitar ajustes
                  </button>

                  <button
                    onClick={() => setActionMode("reject")}
                    className="px-4 py-2 border border-gray-300 text-red-600 hover:bg-red-50 rounded-lg flex gap-2 items-center transition-colors disabled:opacity-60"
                    disabled={loadingItems}
                  >
                    <XCircle size={18} /> Rechazar
                  </button>

                  <button
                    onClick={() => onApprove(req)}
                    className="px-4 py-2 bg-principal hover:opacity-90 text-white rounded-lg flex gap-2 items-center shadow-md transition-colors disabled:opacity-60"
                    disabled={loadingItems}
                  >
                    <CheckCircle size={18} /> Autorizar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
