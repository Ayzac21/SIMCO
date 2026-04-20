import React from "react";
import { X, User, FileText, CheckCircle, XCircle, Briefcase, Building2 } from "lucide-react";
import useEscapeKey from "../../../hooks/useEscapeKey";
import RequisitionTimelineModal from "../../../components/RequisitionTimelineModal";
import { getAuthHeaders } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";

const API = API_BASE_URL;

export default function SecModal({ req, items, loadingItems, onClose, onAction }) {
    const [timelineOpen, setTimelineOpen] = React.useState(false);
    const [itemImagePreviews, setItemImagePreviews] = React.useState({});
    useEscapeKey(Boolean(req), () => onClose?.(), loadingItems);
    React.useEffect(() => {
        setTimelineOpen(false);
        setItemImagePreviews((prev) => {
            Object.values(prev).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
            return {};
        });
    }, [req?.id]);

    React.useEffect(() => {
        let cancelled = false;

        const loadItemImages = async () => {
            const validItems = (items || []).filter(
                (item) =>
                    item?.id &&
                    (item?.image_original_name || item?.image_mime_type || Number(item?.image_size_bytes || 0) > 0)
            );

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
                            `${API}/secretaria/requisiciones/${req.id}/items/${item.id}/image`,
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

    const jefatura = req.nombre_unidad;
    const coordinacion = req.coordinacion;
    const codigoUre = req.ure_solicitante;
    
    const esRechazo = req.statuses_id === 10;
    const justificacion = req.justificacion || "Sin información";
    const observaciones = req.observaciones || "Sin información";
    const motivoRechazo = req.notas || "Sin información";
    const rechazadoPor = req.rejected_by_name || "No disponible";
    const statusId = Number(req.statuses_id || 0);
    const inSecretaria = [9, 10, 12, 13, 14, 11].includes(statusId);
    const inCompras = [12, 13, 14, 11].includes(statusId);
    const isFinalized = statusId === 11;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <RequisitionTimelineModal
                open={timelineOpen}
                requisitionId={req?.id}
                onClose={() => setTimelineOpen(false)}
            />
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-[#8B1D35]/20 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* ENCABEZADO */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            Requisición #{req.id}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                req.statuses_id === 9 ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                req.statuses_id === 12 ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                req.statuses_id === 14 ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                req.statuses_id === 13 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                req.statuses_id === 11 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                req.statuses_id === 10 ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                                {req.nombre_estatus}
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            📅 {new Date(req.created_at).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {Number(req.statuses_id) === 11 && (
                            <button
                                onClick={() => setTimelineOpen(true)}
                                className="px-3 py-2 text-[11px] font-bold rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            >
                                VER PROGRESO
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* CONTENIDO SCROLLEABLE */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    
                    {/* BARRA DE PROGRESO */}
                    <div className="flex justify-between items-center px-4 md:px-10 mb-6 relative">
                        {/* Línea de fondo */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -z-10 transform -translate-y-1/2"></div>
                        
                        {/* 1. SOLICITADO */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#8B1D35] text-white flex items-center justify-center shadow-lg shadow-red-900/20">
                                <CheckCircle size={14} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Solicitado</span>
                        </div>

                        {/* 2. SECRETARÍA (Aquí está el cambio de la "X") */}
                        <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                                statusId === 10 ? 'bg-red-600 text-white border-red-600' :
                                inSecretaria ? 'bg-[#8B1D35] text-white border-[#8B1D35]' :
                                'bg-white border-gray-300 text-gray-300'
                            }`}>
                                {statusId === 10 ? <X size={16} /> : <User size={14} />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                statusId === 10 ? 'text-red-600' :
                                inSecretaria ? 'text-[#8B1D35]' : 'text-gray-300'
                            }`}>
                                {statusId === 10 ? 'Rechazada' : 'Secretaría'}
                            </span>
                        </div>

                        {/* 3. COMPRAS */}
                        <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                inCompras ? 'bg-[#8B1D35] text-white border-[#8B1D35]' : 'bg-white border-gray-300 text-gray-300'
                            }`}>
                                <Briefcase size={14} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${inCompras ? 'text-[#8B1D35]' : 'text-gray-300'}`}>Compras</span>
                        </div>

                        {/* 4. FINALIZADO */}
                        <div className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                                isFinalized ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-300 text-gray-300"
                            }`}>
                                <CheckCircle size={14} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isFinalized ? "text-emerald-700" : "text-gray-300"}`}>
                                Finalizado
                            </span>
                        </div>
                    </div>

                    {/* TARJETAS DE INFORMACIÓN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. TARJETA SOLICITANTE */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full">
                            <div className="flex items-center gap-2 mb-2 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                <User size={12} /> Solicitante
                            </div>
                            <div className="font-bold text-gray-800 text-base">{req.solicitante}</div>
                            <div className="text-xs text-gray-500 font-mono mb-3">{codigoUre}</div>

                            <div className="pt-3 border-t border-gray-200 flex flex-col items-start gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-gray-200 text-[#8B1D35] shadow-sm">
                                    <Building2 size={10} /> 
                                    {jefatura || codigoUre}
                                </span>
                                {coordinacion && coordinacion !== 'General' && (
                                    <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 ml-1">
                                        ↳ {coordinacion}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 2. TARJETA PROYECTO */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 h-full flex flex-col gap-4">
                            
                            <div>
                                <div className="flex items-center gap-2 mb-1 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                    <FileText size={12} /> Proyecto
                                </div>
                                <div className="font-bold text-gray-800 text-base">{req.request_name}</div>
                            </div>

                            <div className="w-full h-px bg-gray-200"></div>

                            <div className="space-y-3">
                                <div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border text-blue-600 bg-blue-50 border-blue-100">
                                        Justificación
                                    </span>
                                    <p className="text-xs mt-2 italic leading-relaxed text-gray-600">
                                        "{justificacion}"
                                    </p>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border text-gray-600 bg-gray-50 border-gray-200">
                                        Observaciones
                                    </span>
                                    <p className="text-xs mt-2 italic leading-relaxed text-gray-600">
                                        "{observaciones}"
                                    </p>
                                </div>

                                {esRechazo && (
                                    <div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border text-red-600 bg-red-50 border-red-100">
                                            Motivo de Rechazo
                                        </span>
                                        <p className="text-xs mt-2 italic leading-relaxed text-red-700 font-medium">
                                            "{motivoRechazo}"
                                        </p>
                                        <p className="text-[11px] mt-1 text-red-800 font-semibold">
                                            Rechazada por: {rechazadoPor}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TABLA DE ARTÍCULOS */}
                    <div>
                        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                            <Briefcase size={16} className="text-[#8B1D35]"/> Artículos Solicitados
                        </h3>
                        <div className="border border-[#8B1D35]/20 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[#8B1D35]/[0.08] text-[#6F152B] font-medium border-b border-[#8B1D35]/20 text-xs">
                                    <tr>
                                        <th className="px-4 py-2 w-16 text-center">Cant.</th>
                                        <th className="px-4 py-2">Descripción</th>
                                        <th className="px-4 py-2 w-24 text-right">Unidad</th>
                                        <th className="px-4 py-2 w-16 text-center">Img</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-xs">
                                    {loadingItems ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-400">Cargando items...</td></tr>
                                    ) : items.length === 0 ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-400">Sin artículos</td></tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 text-center font-bold text-gray-700">{item.quantity}</td>
                                                <td className="px-4 py-3 text-gray-600">{item.description}</td>
                                                <td className="px-4 py-3 text-right text-gray-400 uppercase">{item.unidad || 'PZA'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {itemImagePreviews[String(item.id)] ? (
                                                        <button
                                                            type="button"
                                                            className="h-10 w-10 rounded border border-[#8B1D35]/20 overflow-hidden inline-flex"
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

                </div>

                {/* FOOTER DE ACCIONES */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    {req.statuses_id === 9 && (
                        <>
                            <button 
                                onClick={() => onAction('adjust', req)}
                                className="px-4 py-2 rounded-lg border border-amber-200 text-amber-700 font-bold text-xs hover:bg-amber-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <XCircle size={14}/> REENVIAR A COORDINACIÓN
                            </button>
                            <button 
                                onClick={() => onAction('reject', req)}
                                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <XCircle size={14}/> RECHAZAR
                            </button>
                            <button 
                                onClick={() => onAction('approve', req)}
                                className="px-4 py-2 rounded-lg bg-[#8B1D35] text-white font-bold text-xs hover:bg-[#72182b] transition-all flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <CheckCircle size={14}/> AUTORIZAR
                            </button>
                        </>
                    )}
                    {req.statuses_id !== 9 && (
                        <span className="text-gray-400 text-xs font-medium italic py-2">
                            Esta requisición ya fue procesada
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
