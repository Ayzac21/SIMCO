import React, { useState } from "react";
import { X, CheckCircle, XCircle, FileText, User, AlertTriangle, MessageSquare, Info } from "lucide-react";
import Swal from 'sweetalert2'; // <--- IMPORTANTE

export default function RequisitionModal({ req, items, loadingItems, onClose, onApprove, onReject }) {
    const [isRejecting, setIsRejecting] = useState(false);
    const [reason, setReason] = useState("");

    if (!req) return null;

    const handleConfirmReject = () => {
        if (!reason.trim()) { 
            // ALERTA BONITA
            Swal.fire({
                icon: 'warning',
                title: 'Falta información',
                text: 'Por favor, escribe el motivo del rechazo para continuar.',
                confirmButtonColor: '#EF4444'
            });
            return; 
        }
        onReject(req, reason);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <FileText className="text-principal" /> {req.request_name}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Folio: #{req.id} • {req.area_folio || 'S/F'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {isRejecting ? (
                        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                            <div className="flex items-center gap-2 text-red-700 font-bold mb-3"><AlertTriangle size={20}/> Motivo del Rechazo</div>
                            <textarea className="w-full p-3 border border-red-300 rounded-lg focus:outline-none bg-white" rows="3" 
                                value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Escribe el motivo..."></textarea>
                        </div>
                    ) : (
                        <>
                            {/* Datos del Solicitante */}
                            <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div className="p-2 bg-white rounded-full shadow-sm"><User className="text-blue-600" size={20}/></div>
                                <div>
                                    <p className="text-xs font-bold text-blue-800 uppercase">Solicitante</p>
                                    <p className="font-semibold text-gray-800">{req.solicitante}</p>
                                    <p className="text-sm text-gray-600">{req.ure_solicitante}</p>
                                </div>
                            </div>

                            {/* Motivo de rechazo previo */}
                            {req.notes && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 animate-pulse">
                                    <AlertTriangle className="text-red-600 shrink-0 mt-1" size={18} />
                                    <div>
                                        <p className="text-xs font-bold text-red-800 uppercase mb-1">Motivo / Notas</p>
                                        <p className="text-sm text-gray-800 font-medium">"{req.notes}"</p>
                                    </div>
                                </div>
                            )}

                            {/* Justificación y Observaciones */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {req.justification && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3">
                                        <Info className="text-blue-600 shrink-0 mt-1" size={18} />
                                        <div>
                                            <p className="text-xs font-bold text-blue-800 uppercase mb-1">Justificación</p>
                                            <p className="text-sm text-gray-700 leading-snug">"{req.justification}"</p>
                                        </div>
                                    </div>
                                )}
                                {req.observation && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-3">
                                        <MessageSquare className="text-yellow-600 shrink-0 mt-1" size={18} />
                                        <div>
                                            <p className="text-xs font-bold text-yellow-800 uppercase mb-1">Observaciones</p>
                                            <p className="text-sm text-gray-700 italic leading-snug">"{req.observation}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tabla de Artículos */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">Lista de Artículos</h3>
                                <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[100px]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-2 text-center w-20">Cant.</th>
                                                <th className="px-4 py-2 w-24">Unidad</th>
                                                <th className="px-4 py-2">Descripción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loadingItems ? (
                                                <tr><td colSpan="3" className="p-4 text-center text-gray-400">Cargando...</td></tr>
                                            ) : items.length === 0 ? (
                                                <tr><td colSpan="3" className="p-4 text-center text-gray-400">No hay artículos</td></tr>
                                            ) : (
                                                items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-3 font-bold text-center bg-gray-50/50">{item.quantity || item.cantidad || 0}</td>
                                                        <td className="px-4 py-3 text-gray-600 font-medium">{item.nombre_unidad || item.unit || '-'}</td>
                                                        <td className="px-4 py-3 font-medium text-gray-800">{item.name || item.description || item.concept || item.descripcion}</td>
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
                    {req.statuses_id !== 8 ? (
                        <div className={`w-full text-center font-bold py-3 rounded-lg flex items-center justify-center gap-2
                            ${req.statuses_id === 10 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                        >
                            {req.statuses_id === 10 ? <><XCircle size={20}/> Esta solicitud fue RECHAZADA</> : 
                                req.statuses_id === 9 ? <><CheckCircle size={20}/> Esta solicitud ya fue AUTORIZADA</> : 
                                <><Info size={20}/> Esta solicitud ya fue procesada</>}
                        </div>
                    ) : (
                        <>
                            {isRejecting ? (
                                <>
                                    <button onClick={() => setIsRejecting(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                                    <button onClick={handleConfirmReject} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors">Confirmar Rechazo</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setIsRejecting(true)} className="px-4 py-2 border border-gray-300 text-red-600 hover:bg-red-50 rounded-lg flex gap-2 items-center transition-colors"><XCircle size={18}/> Rechazar</button>
                                    <button onClick={() => onApprove(req)} className="px-4 py-2 bg-principal hover:opacity-90 text-white rounded-lg flex gap-2 items-center shadow-md transition-colors"><CheckCircle size={18}/> Autorizar</button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}