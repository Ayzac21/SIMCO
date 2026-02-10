import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // <--- 1. IMPORTAR ESTO
import { X, User, FileText, CheckCircle, XCircle, ShoppingBag, Building2, MapPin, Download } from "lucide-react";
import { toast } from 'sonner';
import ConfirmModal from "../../../components/ConfirmModal";

const API_OPERATORS = "http://localhost:4000/api/compras/operators";
const API_ASSIGN = "http://localhost:4000/api/compras/requisiciones";
const API_ORDEN_PDF = "http://localhost:4000/api/compras/orden";

const getAuthHeaders = () => {
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    return {
        "x-user-id": String(user?.id || ""),
        "x-user-role": String(user?.role || ""),
    };
};

export default function RequisitionModal({ req, onClose, onAction, onAssigned, readOnly = false }) {
    const navigate = useNavigate(); // <--- 2. INICIALIZAR EL HOOK DE NAVEGACIÓN

    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [operators, setOperators] = useState([]);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignOperatorId, setAssignOperatorId] = useState("");
    const [savingAssign, setSavingAssign] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [providers, setProviders] = useState([]);
    const [loadingProviders, setLoadingProviders] = useState(false);

    // Cargar items cuando se abre el modal
    useEffect(() => {
        if (req && req.id) {
            setLoadingItems(true);
            fetch(`http://localhost:4000/api/compras/requisiciones/${req.id}/items`, {
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
        if (req && req.id && Number(req.statuses_id) === 11) {
            setLoadingProviders(true);
            fetch(`${API_ORDEN_PDF}/${req.id}/providers`, { headers: getAuthHeaders() })
                .then(res => res.json())
                .then(data => setProviders(Array.isArray(data) ? data : []))
                .catch(() => setProviders([]))
                .finally(() => setLoadingProviders(false));
        } else {
            setProviders([]);
        }
    }, [req]);

    if (!req) return null;

    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdmin = user?.role === "compras_admin";

    // Variables auxiliares
    const jefatura = req.nombre_unidad || req.ure_solicitante; 
    const area = req.coordinacion || req.area_solicitante;
    
    // Estatus
    const esRechazo = req.statuses_id === 10;
    
    // Títulos y colores
    const tituloObservacion = esRechazo ? "Motivo de Rechazo" : "Justificación";
    const colorObservacion = esRechazo ? "text-red-600 bg-red-50 border-red-100" : "text-blue-600 bg-blue-50 border-blue-100";

    const textoJustificacion = req.justification || req.observation || req.observaciones || 'Sin justificación';

    const handleConfirmReject = () => {
        if (!rejectReason.trim()) {
            toast.error("Debes escribir el motivo del rechazo.");
            return;
        }
        setConfirmOpen(true);
    };

    const doReject = async () => {
        if (rejecting) return;
        setConfirmOpen(false);
        if (!onAction) return;
        try {
            setRejecting(true);
            await onAction('rechazar', { ...req, motivo: rejectReason });
        } finally {
            setRejecting(false);
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

    const downloadOrdenPdf = async (providerId) => {
        if (downloading) return;
        try {
            setDownloading(true);
            const params = providerId ? `?provider_id=${encodeURIComponent(providerId)}` : "";
            const resp = await fetch(`${API_ORDEN_PDF}/${req.id}/pdf${params}`, {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error("No se pudo generar el PDF");
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (e) {
            console.error(e);
            toast.error(e?.message || "No se pudo generar el PDF");
        } finally {
            setDownloading(false);
        }
    };

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
                title="Rechazar por presupuesto"
                headerText="Confirmar rechazo"
                description="Esta acción marcará la requisición como rechazada. ¿Deseas continuar?"
                confirmText={rejecting ? "Procesando..." : "Sí, rechazar"}
                cancelText="Cancelar"
                onConfirm={doReject}
                onCancel={() => setConfirmOpen(false)}
            />
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            Requisición #{req.id}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-orange-50 text-orange-600 border-orange-100">
                                {req.nombre_estatus || 'EN COTIZACIÓN'}
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            📅 {new Date(req.created_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {Number(req.statuses_id) === 11 && (
                            <div className="flex items-center gap-2">
                                {providers.length <= 1 ? (
                                    <button
                                        onClick={() => downloadOrdenPdf(providers[0]?.id)}
                                        disabled={downloading || loadingProviders}
                                        className={`px-3 py-2 text-[11px] font-bold rounded-lg border flex items-center gap-2 ${
                                            downloading || loadingProviders
                                                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                                                : "bg-white text-[#8B1D35] border-[#8B1D35]/30 hover:bg-[#8B1D35]/10"
                                        }`}
                                    >
                                        <Download size={14} />
                                        {downloading ? "GENERANDO..." : "ORDEN PDF"}
                                    </button>
                                ) : (
                                    providers.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => downloadOrdenPdf(p.id)}
                                            disabled={downloading || loadingProviders}
                                            className={`px-3 py-2 text-[10px] font-bold rounded-lg border flex items-center gap-2 ${
                                                downloading || loadingProviders
                                                    ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                                                    : "bg-white text-[#8B1D35] border-[#8B1D35]/30 hover:bg-[#8B1D35]/10"
                                            }`}
                                        >
                                            <Download size={12} />
                                            {p.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
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
                            Etapa Actual: Compras / Cotización
                        </div>
                    </div>

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
                                        <th className="px-4 py-2 w-16 text-center">Cant.</th>
                                        <th className="px-4 py-2">Descripción</th>
                                        <th className="px-4 py-2 w-24 text-right">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {loadingItems ? (
                                        <tr><td colSpan="3" className="p-4 text-center text-gray-400">Cargando detalles...</td></tr>
                                    ) : items.length === 0 ? (
                                        <tr><td colSpan="3" className="p-4 text-center text-gray-400">Sin artículos listados</td></tr>
                                    ) : (
                                        items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 text-center font-bold text-gray-700">{item.quantity || item.cantidad}</td>
                                                <td className="px-4 py-3 text-gray-600">{item.description || item.descripcion}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 uppercase">{item.unidad}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Área de Rechazo */}
                    {showRejectInput && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-bold text-red-700 uppercase mb-2 block">
                                Motivo del rechazo (Obligatorio):
                            </label>
                            <textarea 
                                className="w-full p-3 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-xs bg-white text-gray-700"
                                rows="3"
                                placeholder="Ej. Falta de presupuesto, fuera de alcance, no aprobado..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
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
                    ) : showRejectInput ? (
                        <>
                            <button onClick={() => setShowRejectInput(false)} className="px-4 py-2 rounded-lg text-gray-500 font-bold text-xs hover:bg-gray-200">CANCELAR</button>
                            <button onClick={handleConfirmReject} disabled={rejecting} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 flex items-center gap-2 disabled:opacity-60">
                                <XCircle size={14}/> RECHAZAR POR PRESUPUESTO
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
                            {isAdmin && (
                                <button onClick={() => setShowRejectInput(true)} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 flex items-center gap-2">
                                    <XCircle size={14}/> RECHAZAR
                                </button>
                            )}
                            
                            {Number(req.statuses_id) === 13 ? (
                                <button 
                                    onClick={() => {
                                        onClose();
                                        navigate(`/compras/orden/${req.id}`);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] flex items-center gap-2 shadow-md"
                                >
                                    <ShoppingBag size={14}/> VER SELECCIÓN
                                </button>
                            ) : Number(req.statuses_id) === 14 ? (
                                <button
                                    disabled
                                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-500 font-bold text-xs flex items-center gap-2 cursor-not-allowed"
                                    title="En revisión: Compras no puede editar"
                                >
                                    <ShoppingBag size={14}/> EN REVISIÓN
                                </button>
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
