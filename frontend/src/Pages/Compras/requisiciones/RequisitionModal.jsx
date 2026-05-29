import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // <--- 1. IMPORTAR ESTO
import { X, User, FileText, CheckCircle, XCircle, ShoppingBag, Building2, MapPin, Download, Paperclip } from "lucide-react";
import { toast } from 'sonner';
import ConfirmModal from "../../../components/ConfirmModal";
import RequisitionTimelineModal from "../../../components/RequisitionTimelineModal";
import { API_BASE_URL } from "../../../api/config";
import useEscapeKey from "../../../hooks/useEscapeKey";
import { getRequisitionUnitLabel } from "../../../utils/unitDisplay";
import { getStatusLabel } from "../../../utils/statusDisplay";

const API_OPERATORS = `${API_BASE_URL}/compras/operators`;
const API_ASSIGN = `${API_BASE_URL}/compras/requisiciones`;
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

export default function RequisitionModal({ req, onClose, onAction, onAssigned, readOnly = false }) {
    const navigate = useNavigate(); // <--- 2. INICIALIZAR EL HOOK DE NAVEGACIÓN

    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    const [actionReason, setActionReason] = useState("");
    const [actionType, setActionType] = useState(null); // reject | adjust | null
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);
    const [operators, setOperators] = useState([]);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignOperatorId, setAssignOperatorId] = useState("");
    const [savingAssign, setSavingAssign] = useState(false);
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);
    const [itemImagePreviews, setItemImagePreviews] = useState({});

    useEscapeKey(Boolean(req), () => {
        if (assignOpen) {
            if (!savingAssign) setAssignOpen(false);
            return;
        }
        if (!processingAction && !loadingItems) onClose?.();
    }, savingAssign || processingAction);

    useEffect(() => {
        setTimelineOpen(false);
        setItemImagePreviews((prev) => {
            Object.values(prev).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
            return {};
        });
    }, [req?.id]);

    // Cargar items cuando se abre el modal
    useEffect(() => {
        if (req && req.id) {
            setLoadingItems(true);
            fetch(`${API_ASSIGN}/${req.id}/items`, {
                headers: getAuthHeaders(),
            })
                .then(res => res.json())
                .then(data => {
                    setItems(data);
                    setLoadingItems(false);
                })
                .catch(err => {
                    console.error("Error cargando items", err);
                    toast.error("Error al cargar los artículos");
                    setLoadingItems(false);
                });
        }
    }, [req]);

    useEffect(() => {
        let cancelled = false;

        const loadItemImages = async () => {
            const validItems = (items || []).filter((item) => {
                if (!item?.id) return false;
                const hasImage =
                    item?.has_image === true ||
                    Number(item?.has_image) === 1 ||
                    String(item?.has_image || "").toLowerCase() === "true";
                return hasImage;
            });
            if (!req?.id || !validItems.length) {
                setItemImagePreviews((prev) => {
                    Object.values(prev).forEach((url) => {
                        if (url) URL.revokeObjectURL(url);
                    });
                    return {};
                });
                return;
            }

            const entries = await Promise.all(
                validItems.map(async (item) => {
                    try {
                        const resp = await fetch(`${API_ASSIGN}/${req.id}/items/${item.id}/image`, {
                            headers: getAuthHeaders(),
                        });
                        if (resp.status === 204) return null;
                        if (!resp.ok) return null;
                        const blob = await resp.blob();
                        if (!blob || blob.size === 0) return null;
                        const url = URL.createObjectURL(blob);
                        return [String(item.id), url];
                    } catch {
                        return null;
                    }
                })
            );

            if (cancelled) {
                entries.forEach((entry) => {
                    if (entry?.[1]) URL.revokeObjectURL(entry[1]);
                });
                return;
            }

            const nextMap = {};
            entries.filter(Boolean).forEach(([id, url]) => {
                nextMap[id] = url;
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
    
    useEffect(() => {
        if (!req?.id) {
            setAttachments([]);
            return;
        }
        setLoadingAttachments(true);
        fetch(`${API_ASSIGN}/${req.id}/attachments`, {
            headers: getAuthHeaders(),
        })
            .then((res) => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then((data) => setAttachments(Array.isArray(data) ? data : []))
            .catch(() => {
                setAttachments([]);
                toast.error("No se pudieron cargar adjuntos");
            })
            .finally(() => setLoadingAttachments(false));
    }, [req?.id]);

    if (!req) return null;

    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdmin = user?.role === "compras_admin";
    const isReader = user?.role === "compras_lector";

    // Variables auxiliares
    const jefatura = getRequisitionUnitLabel(req, "Unidad solicitante");
    const area = req.coordinacion || req.area_solicitante;
    
    // Estatus
    const esRechazo = req.statuses_id === 10;
    
    // Títulos y colores
    const tituloObservacion = esRechazo ? "Motivo de Rechazo" : "Justificación";
    const colorObservacion = esRechazo ? "text-red-600 bg-red-50 border-red-100" : "text-blue-600 bg-blue-50 border-blue-100";

    const textoJustificacion = req.justification || req.observation || req.observaciones || 'Sin justificación';

    const handleConfirmReject = () => {
        if (!actionReason.trim()) {
            toast.error(actionType === "adjust" ? "Debes escribir qué debe editar." : "Debes escribir el motivo del rechazo.");
            return;
        }
        setConfirmOpen(true);
    };

    const doReject = async () => {
        if (processingAction) return;
        setConfirmOpen(false);
        if (!onAction) return;
        try {
            setProcessingAction(true);
            await onAction(actionType === "adjust" ? "ajustar" : "rechazar", {
                ...req,
                motivo: actionReason,
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const openAssign = async () => {
        if (!isAdmin) return;
        try {
            if (operators.length === 0) {
                const res = await fetch(API_OPERATORS, {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setOperators(Array.isArray(data) ? data : []);
            }
            setAssignOperatorId(req.assigned_operator_id ? String(req.assigned_operator_id) : "");
            setAssignOpen(true);
        } catch {
            toast.error("No se pudieron cargar operadores");
        }
    };

    const doAssign = async () => {
        if (!assignOperatorId) {
            toast.error("Selecciona un operador");
            return;
        }
        try {
            setSavingAssign(true);
            const res = await fetch(`${API_ASSIGN}/${req.id}/assign`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ assigned_operator_id: Number(assignOperatorId) }),
            });
            if (!res.ok) throw new Error();
            toast.success("Requisición asignada");
            setAssignOpen(false);
            if (onAssigned) onAssigned();
        } catch {
            toast.error("Error al asignar");
        } finally {
            setSavingAssign(false);
        }
    };

    const downloadAttachment = async (attachment) => {
        try {
            const resp = await fetch(
                `${API_ASSIGN}/${req.id}/attachments/${attachment.id}/download`,
                { headers: getAuthHeaders() }
            );
            if (!resp.ok) throw new Error("No se pudo descargar el adjunto");
            const blob = await resp.blob();
            const disposition = String(resp.headers.get("content-disposition") || "");
            const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
            const rawFilename = (match?.[1] || attachment.original_name || "adjunto").replace(/"/g, "");
            let filename = rawFilename;
            try {
                filename = decodeURIComponent(rawFilename);
            } catch {
                filename = rawFilename;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error(e?.message || "No se pudo descargar el adjunto");
        }
    };

    const statusId = Number(req.statuses_id);
    const isInternalReview = statusId === 14;
    const hasFinanceData = Boolean(
        req.finance_reviewed_at ||
        req.finance_project ||
        req.finance_fund ||
        req.finance_strategic_program ||
        req.finance_observation
    );
    const canOpenEvidence = [13, 16, 11].includes(statusId);
    const stageLabel = isInternalReview
        ? "Compras / Revisión interna"
        : statusId === 11
        ? "Compra finalizada"
        : statusId === 16
        ? "Compras / Aprobada por Finanzas"
        : statusId === 13
        ? "Compras / En proceso"
        : "Compras / Cotización";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {assignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                        <h3 className="text-sm font-bold text-gray-800 mb-1">Asignar requisición</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            #{req.id} • {req.request_name}
                        </p>
                        <label className="text-xs font-bold text-gray-600">Operador</label>
                        <select
                            value={assignOperatorId}
                            onChange={(e) => setAssignOperatorId(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
                        >
                            <option value="">Seleccionar...</option>
                            {operators.map((op) => (
                                <option key={op.id} value={op.id}>
                                    {op.name || op.user_name}
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setAssignOpen(false)}
                                className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={doAssign}
                                disabled={savingAssign}
                                className="px-4 py-2 text-xs font-bold rounded-lg bg-secundario text-white disabled:opacity-60"
                            >
                                {savingAssign ? "Asignando..." : "Asignar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                open={confirmOpen}
                title={actionType === "adjust" ? "Solicitar edición" : "Rechazar por presupuesto"}
                headerText={actionType === "adjust" ? "Confirmar solicitud de edición" : "Confirmar rechazo"}
                description={
                    actionType === "adjust"
                        ? "La requisición regresará a borrador para que el solicitante la edite. ¿Deseas continuar?"
                        : "Esta acción marcará la requisición como cancelada. ¿Deseas continuar?"
                }
                confirmText={processingAction ? "Procesando..." : actionType === "adjust" ? "Sí, solicitar edición" : "Sí, rechazar"}
                cancelText="Cancelar"
                onConfirm={doReject}
                onCancel={() => setConfirmOpen(false)}
            />
            <RequisitionTimelineModal
                open={timelineOpen}
                requisitionId={req?.id}
                onClose={() => setTimelineOpen(false)}
            />
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            Requisición #{req.id}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-orange-50 text-orange-600 border-orange-100">
                                {getStatusLabel(req.statuses_id, req.nombre_estatus || "Cotizando")}
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            📅 {new Date(req.created_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setTimelineOpen(true)}
                            className="px-3 py-2 text-[11px] font-bold rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        >
                            VER PROGRESO
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body con Scroll */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    
                    {/* Stepper visual simplificado */}
                    <div className="flex justify-center items-center gap-4 mb-6">
                        <div className="flex items-center gap-2 text-[#8B1D35] font-bold text-xs uppercase bg-[#8B1D35]/5 px-4 py-2 rounded-full border border-[#8B1D35]/10">
                            <ShoppingBag size={14} />
                            Etapa actual: {stageLabel}
                        </div>
                    </div>

                    {isInternalReview && !isAdmin && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">
                                Requisición en revisión interna
                            </p>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                La comparación ya fue enviada y está en evaluación final por Jefatura de Compras.
                                En esta etapa no se puede editar cotización desde este perfil.
                            </p>
                        </div>
                    )}

                    {statusId === 16 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                                Aprobada por Finanzas
                            </p>
                            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                                Abre la vista completa para revisar proveedor, folios, orden y datos financieros antes de finalizar la compra.
                            </p>
                        </div>
                    )}

                    {(canOpenEvidence || hasFinanceData) && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#8B1D35]">
                                        Evidencia y cierre de compra
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                        Consulta la selección, el comparativo, los datos de Finanzas y la orden generada.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {canOpenEvidence && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                navigate(`/compras/orden/${req.id}`);
                                            }}
                                            className="rounded-lg border border-[#8B1D35]/25 bg-white px-3 py-2 text-[11px] font-bold text-[#8B1D35] hover:bg-[#8B1D35]/5"
                                        >
                                            VER DATOS COMPLETOS
                                        </button>
                                    )}
                                </div>
                            </div>

                            {hasFinanceData && (
                                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                                            Datos capturados por Finanzas
                                        </span>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                                            {Number(req.finance_budget_available || 0) === 1
                                                ? "Presupuesto disponible"
                                                : "Sin confirmación"}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        <div className="rounded-lg border border-emerald-100 bg-white p-2">
                                            <div className="text-[10px] font-bold uppercase text-gray-500">Proyecto</div>
                                            <div className="mt-1 text-xs font-bold text-gray-900">{req.finance_project || "—"}</div>
                                        </div>
                                        <div className="rounded-lg border border-emerald-100 bg-white p-2">
                                            <div className="text-[10px] font-bold uppercase text-gray-500">Fondo</div>
                                            <div className="mt-1 text-xs font-bold text-gray-900">{req.finance_fund || "—"}</div>
                                        </div>
                                        <div className="rounded-lg border border-emerald-100 bg-white p-2">
                                            <div className="text-[10px] font-bold uppercase text-gray-500">Programa</div>
                                            <div className="mt-1 text-xs font-bold text-gray-900">
                                                {req.finance_strategic_program || "—"}
                                            </div>
                                        </div>
                                    </div>
                                    {req.finance_observation && (
                                        <div className="mt-2 rounded-lg border border-emerald-100 bg-white p-2 text-xs text-gray-700">
                                            <span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">
                                                Observación de Finanzas
                                            </span>
                                            {req.finance_observation}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Información Principal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full">
                            <div className="flex items-center gap-2 mb-2 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                <User size={12} /> Solicitante
                            </div>
                            <div className="font-bold text-gray-800 text-base">{req.solicitante}</div>
                            <div className="pt-3 border-t border-gray-200 flex flex-col items-start gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-gray-200 text-[#8B1D35] shadow-sm">
                                    <Building2 size={10} /> {jefatura || "Sin Unidad"}
                                </span>
                                {area && area !== 'General' && (
                                    <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 ml-1 uppercase">
                                        <MapPin size={10} /> {area}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full flex flex-col gap-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                    <FileText size={12} /> Proyecto / Asunto
                                </div>
                                <div className="font-bold text-gray-800 text-base">{req.request_name}</div>
                            </div>
                            <div className="w-full h-px bg-gray-200 my-1"></div>
                            <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${colorObservacion}`}>
                                    {tituloObservacion}
                                </span>
                                <p className="text-xs mt-2 italic text-gray-600 leading-relaxed">
                                    "{esRechazo ? (req.notes || "Sin información") : textoJustificacion}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Artículos */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                            <ShoppingBag size={16} className="text-[#8B1D35]"/> Artículos a Cotizar
                        </h3>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 text-xs">
                                    <tr>
                                        <th className="px-4 py-2 w-[20%]">Producto</th>
                                        <th className="px-4 py-2 w-[56%]">Descripción</th>
                                        <th className="px-4 py-2 w-14 text-center">Cant.</th>
                                        <th className="px-4 py-2 w-20 text-right">Unidad</th>
                                        <th className="px-4 py-2 w-20 text-center">Img</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {loadingItems ? (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-400">Cargando detalles...</td></tr>
                                    ) : items.length === 0 ? (
                                        <tr><td colSpan="5" className="p-4 text-center text-gray-400">Sin artículos listados</td></tr>
                                    ) : (
                                        items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 text-gray-600">
                                                    {item.product_name ||
                                                        item.name ||
                                                        item.producto ||
                                                        "—"}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 leading-snug">{item.description || item.descripcion || "—"}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-700">{item.quantity || item.cantidad}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 uppercase">{item.unidad}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {itemImagePreviews[String(item.id)] ? (
                                                        <button
                                                            type="button"
                                                            className="h-12 w-12 rounded border border-[#8B1D35]/20 overflow-hidden inline-flex"
                                                            title="Abrir imagen"
                                                            onClick={() =>
                                                                window.open(
                                                                    itemImagePreviews[String(item.id)],
                                                                    "_blank",
                                                                    "noopener,noreferrer"
                                                                )
                                                            }
                                                        >
                                                            <img
                                                                src={itemImagePreviews[String(item.id)]}
                                                                alt={`Imagen partida ${item.id}`}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                            <Paperclip size={16} className="text-[#8B1D35]" /> Adjuntos
                        </h3>
                        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                            {loadingAttachments ? (
                                <div className="p-4 text-xs text-gray-500">Cargando adjuntos...</div>
                            ) : attachments.length === 0 ? (
                                <div className="p-4 text-xs text-gray-400">Sin adjuntos.</div>
                            ) : (
                                attachments.map((att) => (
                                    <div key={att.id} className="p-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-700 truncate">{att.original_name}</p>
                                            <p className="text-[11px] text-gray-400">
                                                {att.mime_type || "archivo"} · {Math.max(1, Math.round((Number(att.size_bytes || 0) / 1024) * 10) / 10)} KB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => downloadAttachment(att)}
                                            className="px-3 py-1.5 rounded-md border border-[#8B1D35]/30 text-[#8B1D35] text-[11px] font-bold hover:bg-[#8B1D35]/10 flex items-center gap-1.5"
                                        >
                                            <Download size={12} />
                                            Descargar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Área de Rechazo */}
                    {actionType && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-bold text-red-700 uppercase mb-2 block">
                                {actionType === "adjust" ? "Motivo de edición (Obligatorio):" : "Motivo del rechazo (Obligatorio):"}
                            </label>
                            <textarea 
                                className="w-full p-3 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-xs bg-white text-gray-700"
                                rows="3"
                                placeholder={actionType === "adjust" ? "Ej. Corrige cantidades, especificaciones o justificación..." : "Ej. Falta de presupuesto, fuera de alcance, no aprobado..."}
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Acciones */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    {readOnly ? (
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-500 font-bold text-xs hover:bg-gray-200">
                            Cerrar
                        </button>
                    ) : actionType ? (
                        <>
                            <button onClick={() => setActionType(null)} className="px-4 py-2 rounded-lg text-gray-500 font-bold text-xs hover:bg-gray-200">CANCELAR</button>
                            <button onClick={handleConfirmReject} disabled={processingAction} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 flex items-center gap-2 disabled:opacity-60">
                                <XCircle size={14}/> {actionType === "adjust" ? "SOLICITAR EDICIÓN" : "RECHAZAR POR PRESUPUESTO"}
                            </button>
                        </>
                    ) : (
                        <>
                            {isAdmin && Number(req.statuses_id) === 12 && (
                                <button
                                    onClick={openAssign}
                                    className="px-4 py-2 rounded-lg border border-secundario/30 text-secundario font-bold text-xs hover:bg-secundario/10 flex items-center gap-2"
                                >
                                    <CheckCircle size={14}/> ASIGNAR
                                </button>
                            )}
                            {isAdmin && statusId !== 16 && (
                                <button onClick={() => setActionType("adjust")} className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 font-bold text-xs hover:bg-amber-50 flex items-center gap-2">
                                    <XCircle size={14}/> SOLICITAR EDICIÓN
                                </button>
                            )}
                            {isAdmin && statusId !== 16 && (
                                <button onClick={() => setActionType("reject")} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 flex items-center gap-2">
                                    <XCircle size={14}/> RECHAZAR
                                </button>
                            )}
                            
                            {statusId === 13 || statusId === 16 ? (
                                <button 
                                    onClick={() => {
                                        onClose();
                                        navigate(`/compras/orden/${req.id}`);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] flex items-center gap-2 shadow-md"
                                >
                                    <ShoppingBag size={14}/> {statusId === 16 ? "VER DATOS COMPLETOS" : "VER SELECCIÓN"}
                                </button>
                            ) : statusId === 14 ? (
                                <>
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                onClose();
                                                navigate(`/compras/revision/${req.id}`);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] flex items-center gap-2 shadow-md"
                                            title="Abrir cuadro comparativo para selección final"
                                        >
                                            <ShoppingBag size={14}/> REVISAR COMPARATIVO
                                        </button>
                                    )}
                                    {isReader && (
                                        <>
                                            <button
                                                onClick={() => setTimelineOpen(true)}
                                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 flex items-center gap-2"
                                            >
                                                VER PROGRESO
                                            </button>
                                            <button
                                                disabled
                                                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-500 font-bold text-xs flex items-center gap-2 cursor-not-allowed"
                                                title="En revisión interna por Compras Admin"
                                            >
                                                <ShoppingBag size={14}/> EN REVISIÓN INTERNA
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <button 
                                    onClick={() => {
                                        onClose();
                                        navigate(`/compras/cotizar/${req.id}`);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] flex items-center gap-2 shadow-md"
                                >
                                    <ShoppingBag size={14}/> GESTIONAR COTIZACIÓN
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
