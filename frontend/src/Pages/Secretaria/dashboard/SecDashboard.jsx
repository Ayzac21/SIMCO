import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle, XCircle, BarChart3, Lightbulb } from "lucide-react";
import { toast } from 'sonner'; 
import SecModal from "./SecModal"; 

export default function SecDashboard() {
    const [allReqs, setAllReqs] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    // Estados del Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    // Estado de Confirmación
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, req: null, motivo: '' });

    const userId = localStorage.getItem("users_id");

    const fetchData = async () => {
        if (!userId) return;
        try {
            // Llama al backend corregido
            const res = await fetch(`http://localhost:4000/api/secretaria/${userId}/recibidas`);
            if (res.ok) {
                const data = await res.json();
                setAllReqs(data);
            }
        } catch (error) { 
            console.error(error);
            toast.error("Error al cargar datos");
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchData(); }, [userId]);

    // --- FILTROS PARA LOS CONTADORES ---
    const pendientes = allReqs.filter(r => r.statuses_id === 9);
    const procesadas = allReqs.filter(r => r.statuses_id === 12); // Autorizadas
    const rechazadas = allReqs.filter(r => r.statuses_id === 10); // Rechazadas

    // --- TOP DEPARTAMENTOS ---
    const getTopDepartments = () => {
        const counts = {};
        allReqs.forEach(req => {
            const dept = req.ure_solicitante || "General";
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).sort(([,a], [,b]) => b - a).slice(0, 3).map(([name, count]) => ({ name, count }));
    };
    const topDepts = getTopDepartments();
    const maxCount = topDepts.length > 0 ? topDepts[0].count : 1;

    // --- FUNCIONES DEL MODAL Y ACCIONES ---
    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setModalItems([]);
        setLoadingItems(true);
        try {
            const res = await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/items`);
            if (res.ok) { setModalItems(await res.json()); }
        } catch (error) { toast.error("Error al cargar items"); } 
        finally { setLoadingItems(false); }
    };

    const initiateAction = (type, req, motivo = '') => setConfirmDialog({ isOpen: true, type, req, motivo });

    const executeAction = async () => {
        const { type, req, motivo } = confirmDialog;
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        const toastId = toast.loading("Procesando solicitud...");

        try {
            // 12 = Autorizada, 10 = Rechazada
            const statusId = type === 'approve' ? 12 : 10;
            const comentarios = type === 'approve' ? "Autorizado por Secretaría" : motivo;

            const res = await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status_id: statusId, comentarios })
            });

            if (res.ok) {
                toast.success(type === 'approve' ? "¡Autorizado correctamente!" : "Solicitud rechazada", { id: toastId });
                setSelectedReq(null);
                fetchData(); // ¡Importante! Recarga para mover la req de "Pendiente" a "Procesada"
            } else { throw new Error(); }
        } catch (error) { toast.error("Error al procesar", { id: toastId }); }
    };

    // --- RENDERIZADO DE ETIQUETAS (Colores iguales a Coordinador) ---
    const renderStatusBadge = (statusId) => {
        switch(statusId) {
            case 9: return <span className="bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">● En secretaría</span>;
            case 12: return <span className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">● En cotización</span>;
            case 10: return <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">● Rechazado</span>;
            default: return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Desconocido</span>;
        }
    };

    return (
        <div className="space-y-6">
            <SecModal req={selectedReq} items={modalItems} loadingItems={loadingItems} onClose={() => setSelectedReq(null)} onAction={initiateAction} />

            {/* Confirmación Popup */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
                        <div className="text-center">
                            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.type === 'approve' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {confirmDialog.type === 'approve' ? <CheckCircle size={24}/> : <AlertTriangle size={24}/>}
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg mb-2">{confirmDialog.type === 'approve' ? '¿Autorizar Presupuesto?' : '¿Rechazar Solicitud?'}</h3>
                            <p className="text-sm text-gray-500 mb-6">{confirmDialog.type === 'approve' ? "Pasará a compras para cotización." : "Esta acción es definitiva."}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
                                <button onClick={executeAction} className={`flex-1 py-2 rounded-lg text-white font-bold shadow-md ${confirmDialog.type === 'approve' ? 'bg-[#8B1D35] hover:bg-[#701529]' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Por Validar</p><p className="text-3xl font-bold text-gray-800 mt-1">{pendientes.length}</p></div>
                    <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 border border-yellow-100"><Clock size={20}/></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-50 flex justify-between items-center">
                    <div><p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Urgentes</p><p className="text-3xl font-bold text-red-600 mt-1">0</p><p className="text-[9px] text-red-400 mt-1">Atención inmediata</p></div>
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100"><AlertTriangle size={20}/></div>
                </div>
                {/* PROCESADAS: Aquí se sumarán las que aceptes (Status 12) */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Procesadas</p><p className="text-3xl font-bold text-gray-800 mt-1">{procesadas.length}</p></div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100"><CheckCircle size={20}/></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rechazadas</p><p className="text-3xl font-bold text-gray-800 mt-1">{rechazadas.length}</p></div>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200"><XCircle size={20}/></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* TABLA PRINCIPAL */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[400px]">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">📄 Actividad Reciente</h3>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-50">
                                {allReqs.length === 0 ? (
                                    <tr><td className="p-8 text-center text-gray-400 text-sm">No hay actividad reciente</td></tr>
                                ) : allReqs.map((req) => (
                                    <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-gray-50 cursor-pointer group transition-colors">
                                        <td className="px-6 py-4 w-16">
                                            <span className="font-bold text-gray-700 group-hover:text-[#8B1D35] transition">#{req.id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-800">{req.request_name}</div>
                                            <div className="text-xs text-gray-400 uppercase mt-0.5">{req.solicitante}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {renderStatusBadge(req.statuses_id)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR DERECHO */}
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={18} className="text-gray-400" />
                            <h3 className="font-bold text-gray-800 text-sm">Top Departamentos</h3>
                        </div>
                        <div className="space-y-4">
                            {topDepts.length === 0 ? <p className="text-xs text-gray-400 italic">Sin datos</p> : 
                            topDepts.map((dept, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span className="text-gray-700 truncate w-3/4">{dept.name}</span>
                                        <span className="text-gray-900">{dept.count} reqs</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-[#8B1D35] h-1.5 rounded-full" style={{ width: `${(dept.count / maxCount) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex items-start gap-3">
                        <Lightbulb size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-blue-800 font-bold mb-1">Tip Administrativo:</p>
                            <p className="text-xs text-blue-700/80 leading-relaxed">Verifica el presupuesto mensual.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}