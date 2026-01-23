import React, { useState } from "react";
import { 
    X, User, FileText, Package, CheckCircle, XCircle, 
    AlertCircle, Calendar, Building, MessageSquare,
    Clock, Truck
} from "lucide-react";
import { toast } from "sonner";

export default function SecModal({ req, items, loadingItems, onClose, onAction }) {
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    if (!req) return null;

    // --- 1. FUNCIÓN PARA FORMATEAR LA FECHA ---
    const formatDate = (dateString) => {
        if (!dateString) return "Sin fecha";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-MX', { 
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    // --- 2. LOGICA VISUAL DE ESTATUS ---
    const getStatusInfo = (statusId) => {
        switch(statusId) {
            case 9: return { label: "PENDIENTE DE VALIDACIÓN", color: "bg-blue-100 text-blue-700 border-blue-200", icon: <Clock size={16}/> };
            case 10: return { label: "RECHAZADA", color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle size={16}/> };
            case 12: return { label: "EN PROCESO DE COMPRA", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Truck size={16}/> };
            default: return { label: "DESCONOCIDO", color: "bg-gray-100 text-gray-600", icon: <AlertCircle size={16}/> };
        }
    };
    
    const statusInfo = getStatusInfo(req.statuses_id);

    // --- HANDLERS ---
    const handleSubmitRejection = () => {
        if (!rejectionReason.trim() || rejectionReason.length < 5) {
            toast.error("Por favor escribe un motivo detallado.");
            return;
        }
        onAction('reject', req, rejectionReason);
    };

    const handleCancelRejection = () => {
        setIsRejecting(false);
        setRejectionReason("");
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 transition-all font-sans">
                
                {/* --- HEADER --- */}
                <div className="px-8 py-6 border-b border-gray-100 bg-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl font-bold text-gray-800">Requisición #{req.id}</span>
                            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${statusInfo.color}`}>
                                {statusInfo.icon}
                                {statusInfo.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 font-medium uppercase tracking-wide">
                            <span className="flex items-center gap-1"><Calendar size={14}/> {formatDate(req.created_at || req.fecha_creacion)}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition"><X size={24}/></button>
                </div>

                {/* --- PROGRESO VISUAL --- */}
                {!isRejecting && (
                    <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-0 rounded-full"></div>
                            {[
                                { id: 1, label: "Solicitado", active: true },
                                { id: 2, label: "Secretaría", active: true },
                                { id: 3, label: "Compras/Cotiz.", active: req.statuses_id === 12 },
                                { id: 4, label: "Finalizado", active: false } 
                            ].map((step, idx) => (
                                <div key={idx} className="relative z-10 flex flex-col items-center bg-white px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                                        step.active 
                                        ? "bg-[#8B1D35] border-[#8B1D35] text-white" 
                                        : "bg-white border-gray-300 text-gray-300"
                                    }`}>
                                        {step.active ? <CheckCircle size={14}/> : <span className="text-xs font-bold">{step.id}</span>}
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 uppercase ${step.active ? "text-[#8B1D35]" : "text-gray-400"}`}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- BODY --- */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                    
                    {/* ZONA DE RECHAZO */}
                    {isRejecting && (
                        <div className="mb-8 bg-red-50 p-6 rounded-xl border border-red-100 animate-in slide-in-from-top-4 shadow-sm">
                            <h4 className="flex items-center gap-2 text-red-800 font-bold mb-3">
                                <AlertCircle size={20}/> Motivo del Rechazo
                            </h4>
                            <textarea
                                autoFocus
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Describe por qué no procede esta solicitud..."
                                className="w-full p-4 rounded-lg border-red-200 focus:border-red-500 focus:ring-red-500 min-h-[120px] text-sm text-gray-700 bg-white shadow-inner"
                            />
                        </div>
                    )}

                    {/* CONTENIDO PRINCIPAL */}
                    <div className={`transition-all duration-300 space-y-6 ${isRejecting ? 'opacity-40 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-4 space-y-4">
                                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-1"><User size={12}/> Solicitante</p>
                                    <p className="text-sm font-bold text-gray-800">{req.solicitante}</p>
                                    <p className="text-xs text-gray-500">{req.ure_solicitante}</p>
                                </div>
                                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 mb-1"><Building size={12}/> Proyecto / Asunto</p>
                                    <p className="text-sm font-bold text-gray-800">{req.request_name}</p>
                                </div>
                            </div>

                            <div className="md:col-span-8">
                                <div className="h-full p-5 rounded-xl border border-blue-100 bg-blue-50/30">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2 mb-2"><MessageSquare size={12}/> Observaciones / Justificación</p>
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                                        {req.observaciones ? req.observaciones : <span className="text-gray-400 italic">Sin observaciones adicionales registradas.</span>}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* TABLA DE ARTÍCULOS */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                <Package size={18} className="text-[#8B1D35]"/>
                                <h4 className="font-bold text-gray-700 text-sm">Detalle de Artículos</h4>
                            </div>
                            
                            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-center w-24">Cantidad</th>
                                            <th className="px-6 py-3">Descripción del Bien / Servicio</th>
                                            <th className="px-6 py-3 text-center w-32">Unidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {loadingItems ? (
                                            <tr><td colSpan="3" className="p-8 text-center text-gray-400">Cargando detalles...</td></tr>
                                        ) : items.map((item, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 font-bold rounded-md text-xs">
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 font-medium">{item.description}</td>
                                                
                                                {/* --- AQUÍ ESTÁ EL CAMBIO --- */}
                                                <td className="px-6 py-4 text-center text-gray-400 text-xs uppercase">
                                                    {item.nombre_unidad || item.unit || "N/A"}
                                                </td>
                                                {/* --------------------------- */}
                                                
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- FOOTER ACTIONS --- */}
                {req.statuses_id === 9 && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-20">
                        {isRejecting ? (
                            <>
                                <button onClick={handleCancelRejection} className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white font-bold text-sm transition">
                                    Cancelar
                                </button>
                                <button onClick={handleSubmitRejection} className="px-6 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold shadow-lg shadow-red-200 text-sm transition flex items-center gap-2">
                                    <XCircle size={18}/> Confirmar Rechazo
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsRejecting(true)} className="px-6 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition flex items-center gap-2">
                                    <XCircle size={18}/> Rechazar
                                </button>
                                <button onClick={() => onAction('approve', req)} className="px-8 py-2.5 rounded-lg bg-[#8B1D35] text-white hover:bg-[#701529] font-bold shadow-lg shadow-red-900/20 text-sm transition flex items-center gap-2">
                                    <CheckCircle size={18}/> Autorizar Presupuesto
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}