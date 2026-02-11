import React, { useEffect, useState, useMemo } from "react";
import { 
    Clock, CheckCircle, XCircle, BarChart3, FileText,
    Truck, ArrowRight, User, Briefcase, Loader2, AlertTriangle, Lightbulb 
} from "lucide-react";
import { toast } from 'sonner'; 
import { useNavigate } from "react-router-dom"; 
import SecModal from "./SecModal"; 
import { getAuthHeaders } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";

export default function SecDashboard() {
    // --- ESTADO ---
    const [allReqs, setAllReqs] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    // Estado del diálogo de confirmación
    const [confirmDialog, setConfirmDialog] = useState({ 
        isOpen: false, 
        type: null, 
        req: null, 
        motivo: '' 
    });

    const navigate = useNavigate(); 
    const userId = localStorage.getItem("users_id");

    // --- CARGAR DATOS ---
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!userId) { if (isMounted) setLoading(false); return; }
            try {
                const params = new URLSearchParams({
                    page: "1",
                    limit: "50",
                    q: "",
                    status: "todos",
                });
                const res = await fetch(`${API_BASE_URL}/secretaria/${userId}/recibidas?${params.toString()}`, {
                    headers: getAuthHeaders(),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) setAllReqs(Array.isArray(data?.rows) ? data.rows : []);
                } else { if (isMounted) setAllReqs([]); }
            } catch (error) { if (isMounted) setAllReqs([]); } 
            finally { if (isMounted) setLoading(false); }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [userId]);

    // --- CÁLCULOS ---
    const { pendientes, procesadas, rechazadas } = useMemo(() => {
        const safeReqs = Array.isArray(allReqs) ? allReqs : [];
        return {
            pendientes: safeReqs.filter(r => Number(r.statuses_id) === 9),
            procesadas: safeReqs.filter(r => Number(r.statuses_id) === 12),
            rechazadas: safeReqs.filter(r => Number(r.statuses_id) === 10)
        };
    }, [allReqs]);

    const topDepts = useMemo(() => {
        if (!Array.isArray(allReqs) || allReqs.length === 0) return [];
        const counts = {};
        allReqs.forEach(req => {
            const dept = req.nombre_unidad || req.ure_solicitante || "Sin Código";
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).sort(([,a], [,b]) => b - a).slice(0, 3).map(([name, count]) => ({ name, count }));
    }, [allReqs]);
    
    const maxCount = topDepts.length > 0 ? topDepts[0].count : 1;

    // --- HANDLERS ---
    const handleRowClick = async (req) => {
        if (!req) return;
        setSelectedReq(req);
        setModalItems([]);
        setLoadingItems(true);
        try {
            const res = await fetch(`${API_BASE_URL}/secretaria/requisiciones/${req.id}/items`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) { 
                const data = await res.json();
                setModalItems(Array.isArray(data) ? data : []); 
            }
        } catch (error) { toast.error("Error al cargar items"); } 
        finally { setLoadingItems(false); }
    };

    const initiateAction = (type, req) => {
        setConfirmDialog({ isOpen: true, type, req, motivo: '' });
    };

    const executeAction = async () => {
        const { type, req, motivo } = confirmDialog;
        if (!req) return;

        if (type === 'reject' && !motivo.trim()) {
            toast.error("Debes escribir un motivo para rechazar.");
            return;
        }

        setConfirmDialog({ ...confirmDialog, isOpen: false });
        const toastId = toast.loading("Procesando...");
        try {
            const statusId = type === 'approve' ? 12 : 10;
            const comentarios = type === 'approve' ? "Autorizado por Secretaría" : motivo;
            
            const res = await fetch(`${API_BASE_URL}/secretaria/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ status_id: statusId, comentarios })
            });
            if (res.ok) {
                toast.success(type === 'approve' ? "¡Autorizado!" : "Rechazada", { id: toastId });
                setSelectedReq(null);
                const refreshParams = new URLSearchParams({
                    page: "1",
                    limit: "50",
                    q: "",
                    status: "todos",
                });
                const refreshRes = await fetch(`${API_BASE_URL}/secretaria/${userId}/recibidas?${refreshParams.toString()}`, {
                    headers: getAuthHeaders(),
                });
                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    setAllReqs(Array.isArray(data?.rows) ? data.rows : []);
                }
            } else { throw new Error(); }
        } catch (error) { toast.error("Error al procesar", { id: toastId }); }
    };

    const renderStatusBadge = (statusId) => {
        switch(statusId) {
            case 9: return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Clock size={10} /> En Revisión</span>;
            case 12: return <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Truck size={10} /> En Compras</span>;
            case 10: return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><XCircle size={10} /> Rechazada</span>;
            default: return null;
        }
    };

    if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="animate-spin text-[#8B1D35]" size={40}/></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* 1. EL MODAL */}
            {selectedReq && (
                <SecModal 
                    req={selectedReq} 
                    items={modalItems} 
                    loadingItems={loadingItems} 
                    onClose={() => setSelectedReq(null)} 
                    onAction={initiateAction} 
                />
            )}

            {/* 2. DIÁLOGO DE CONFIRMACIÓN */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform scale-100 transition-all">
                        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.type === 'approve' ? 'bg-secundario/10 text-secundario' : 'bg-red-100 text-red-600'}`}>
                            {confirmDialog.type === 'approve' ? <CheckCircle size={24}/> : <XCircle size={24}/>}
                        </div>
                        
                        <h3 className="font-bold text-gray-800 text-lg mb-2">
                            {confirmDialog.type === 'approve' ? '¿Autorizar Solicitud?' : '¿Rechazar Solicitud?'}
                        </h3>
                        
                        {confirmDialog.type === 'reject' ? (
                            <div className="text-left mb-4">
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Motivo del rechazo:</label>
                                <textarea 
                                    className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none bg-gray-50"
                                    rows="3"
                                    placeholder="Escribe aquí por qué se rechaza..."
                                    value={confirmDialog.motivo}
                                    onChange={(e) => setConfirmDialog({...confirmDialog, motivo: e.target.value})}
                                    autoFocus
                                ></textarea>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm mb-6">
                                La solicitud pasará al departamento de compras.
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} 
                                className="flex-1 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            
                            <button 
                                onClick={executeAction} 
                                disabled={confirmDialog.type === 'reject' && !confirmDialog.motivo.trim()}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-white shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                    confirmDialog.type === 'approve' 
                                    ? 'bg-[#8B1D35] hover:bg-[#72182b]' 
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {confirmDialog.type === 'approve' ? 'Confirmar' : 'Rechazar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. TARJETAS SUPERIORES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Por Validar</p><p className="text-3xl font-bold text-gray-800 mt-1">{pendientes.length}</p></div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 h-fit"><Clock size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 ring-1 ring-red-50 flex justify-between">
                    <div><p className="text-[10px] font-bold text-red-400 uppercase">Urgentes</p><p className="text-3xl font-bold text-red-600 mt-1">0</p><p className="text-[10px] text-red-400 mt-1">Atención inmediata</p></div>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600 h-fit"><AlertTriangle size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">En Compras</p><p className="text-3xl font-bold text-gray-800 mt-1">{procesadas.length}</p></div>
                    <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600 h-fit"><Truck size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Rechazadas</p><p className="text-3xl font-bold text-gray-800 mt-1">{rechazadas.length}</p></div>
                    <div className="p-2 bg-gray-50 rounded-lg text-gray-400 h-fit"><XCircle size={20} /></div>
                </div>
            </div>

            {/* 4. TABLA Y SIDEBAR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* TABLA PRINCIPAL */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18}/> Actividad Reciente</h3>
                        <button onClick={() => navigate('/secretaria/recibidas')} className="text-xs font-bold text-gray-600 hover:text-[#8B1D35] flex items-center gap-1">
                            Ver más <ArrowRight size={12}/>
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-50">
                                {allReqs.length === 0 ? (
                                    <tr><td className="p-8 text-center text-gray-400 text-sm">No hay requisiciones recientes</td></tr>
                                ) : allReqs.slice(0, 5).map((req) => { // <--- AQUÍ ESTÁ EL CAMBIO A 5
                                    const jefatura = req.nombre_unidad;
                                    const coordinacion = req.coordinacion;
                                    const codigoUre = req.ure_solicitante;

                                    return (
                                        <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-gray-50 cursor-pointer group transition-colors">
                                            <td className="px-6 py-4 align-top w-16">
                                                <span className="font-bold text-gray-700">#{req.id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 mb-1">{req.request_name}</div>
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10">
                                                        <Briefcase size={10} /> 
                                                        <span className="truncate max-w-[200px]">{jefatura || codigoUre}</span>
                                                    </span>
                                                    {coordinacion && coordinacion !== 'General' && (
                                                        <span className="text-[10px] text-gray-500 font-semibold ml-1 flex items-center gap-1">
                                                            ↳ {coordinacion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1.5">
                                                    <User size={12}/> {req.solicitante}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right align-middle">
                                                {renderStatusBadge(req.statuses_id)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR DERECHO */}
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2"><BarChart3 size={16}/> Top Áreas</h3>
                        <div className="space-y-4">
                            {topDepts.map((dept, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700">
                                        <span className="truncate w-3/4">{dept.name}</span>
                                        <span>{dept.count}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                        <div className="bg-[#8B1D35] h-1.5 rounded-full" style={{ width: `${(dept.count / maxCount) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                            {topDepts.length === 0 && <p className="text-xs text-gray-400">Sin datos aún</p>}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex gap-3">
                        <Lightbulb className="text-blue-600 flex-shrink-0" size={20} />
                        <div>
                            <h4 className="text-sm font-bold text-blue-800 mb-1">Tip Administrativo:</h4>
                            <p className="text-xs text-blue-700 leading-relaxed">
                                Verifica el presupuesto mensual antes de aprobar solicitudes grandes para evitar rechazos posteriores.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
