import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // <--- 1. IMPORTAR ESTO
import { X, User, FileText, CheckCircle, XCircle, ShoppingBag, Building2, MapPin } from "lucide-react";
import { toast } from 'sonner';

export default function RequisitionModal({ req, onClose, onAction }) {
    const navigate = useNavigate(); // <--- 2. INICIALIZAR EL HOOK DE NAVEGACIÓN

    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Cargar items cuando se abre el modal
    useEffect(() => {
        if (req && req.id) {
            setLoadingItems(true);
            fetch(`http://localhost:4000/api/compras/requisiciones/${req.id}/items`)
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

    if (!req) return null;

    // Variables auxiliares
    const jefatura = req.nombre_unidad || req.ure_solicitante; 
    const area = req.coordinacion || req.area_solicitante;
    
    // Estatus
    const esRechazo = req.statuses_id === 10;
    
    // Títulos y colores
    const tituloObservacion = esRechazo ? "Motivo de Rechazo" : "Justificación";
    const colorObservacion = esRechazo ? "text-red-600 bg-red-50 border-red-100" : "text-blue-600 bg-blue-50 border-blue-100";

    const textoJustificacion = req.observation || req.justification || req.observaciones || 'Sin justificación';

    const handleConfirmReject = () => {
        if (!rejectReason.trim()) {
            toast.error("Debes escribir el motivo del rechazo.");
            return;
        }
        if(onAction) onAction('rechazar', { ...req, motivo: rejectReason });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
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
                                    "{textoJustificacion}"
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
                                placeholder="Escribe aquí por qué no se puede realizar la compra..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Acciones */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    {showRejectInput ? (
                        <>
                            <button onClick={() => setShowRejectInput(false)} className="px-4 py-2 rounded-lg text-gray-500 font-bold text-xs hover:bg-gray-200">CANCELAR</button>
                            <button onClick={handleConfirmReject} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 flex items-center gap-2">
                                <XCircle size={14}/> CONFIRMAR RECHAZO
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setShowRejectInput(true)} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 flex items-center gap-2">
                                <XCircle size={14}/> RECHAZAR
                            </button>
                            
                            {/* --- BOTÓN ACTUALIZADO PARA IR A LA GESTIÓN --- */}
                            <button 
                                onClick={() => {
                                    onClose(); // Cerrar modal
                                    navigate(`/compras/cotizar/${req.id}`); // Ir a la pantalla de gestión
                                }}
                                className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] flex items-center gap-2 shadow-md"
                            >
                                <ShoppingBag size={14}/> GESTIONAR COTIZACIÓN
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}