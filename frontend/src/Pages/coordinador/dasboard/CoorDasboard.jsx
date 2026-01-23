import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import RequisitionModal from "../requisiciones/RequisitionModal"; 
import Swal from 'sweetalert2'; 
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// --- 1. FUNCIÓN DE COLORES UNIFICADA (Idéntica a Recibidas) ---
const renderStatusBadge = (statusId, statusName) => {
    let styles = "bg-gray-100 text-gray-600 border-gray-200"; 

    switch (statusId) {
        case 8: // En coordinación - AMARILLO
            styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
            break;
        case 9: // En secretaría - AZUL
            styles = "bg-blue-50 text-blue-700 border-blue-200";
            break;
        case 10: // Rechazado - ROJO
            styles = "bg-red-50 text-red-700 border-red-200";
            break;
        case 12: // En cotización - NARANJA
            styles = "bg-orange-50 text-orange-700 border-orange-200";
            break;
        case 11: // Comprado - VERDE
        case 13: // En proceso - VERDE
            styles = "bg-green-50 text-green-700 border-green-200";
            break;
        default:
            break;
    }

    return (
        <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold border ${styles} inline-flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-50`}></span>
            {statusName || "Sin Estatus"}
        </span>
    );
};

export default function CoorDashboard() {
    const navigate = useNavigate();
    
    // --- ESTADOS ---
    const [stats, setStats] = useState({ pendientes: 0, procesadas: 0, rechazadas: 0, rezagadas: 0 });
    const [recentReqs, setRecentReqs] = useState([]);
    const [topUres, setTopUres] = useState([]); 
    const [loading, setLoading] = useState(true);

    // --- MODAL ---
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]); 
    const [loadingItems, setLoadingItems] = useState(false);

    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const storageId = localStorage.getItem("users_id");
    const coordinadorId = storageId || (user ? user.id : null);

    // --- CARGA DE DATOS ---
    useEffect(() => {
        if (!coordinadorId) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/coordinador/${coordinadorId}/recibidas`);
                if (!res.ok) throw new Error("Error al cargar datos");
                
                const data = await res.json();

                if (Array.isArray(data)) {
                    // Filtros para las tarjetas superiores (KPIs)
                    const pendientes = data.filter(r => r.statuses_id === 8); // ID 8 = En coordinación
                    
                    const numProcesadas = data.filter(r => [9, 11, 12, 13].includes(r.statuses_id)).length;
                    const numRechazadas = data.filter(r => r.statuses_id === 10).length;

                    // Rezagadas (+3 días)
                    const hoy = new Date();
                    const numRezagadas = pendientes.filter(r => {
                        const fechaCreacion = new Date(r.created_at);
                        return ((hoy - fechaCreacion) / (1000 * 60 * 60 * 24)) > 3; 
                    }).length;

                    setStats({ pendientes: pendientes.length, procesadas: numProcesadas, rechazadas: numRechazadas, rezagadas: numRezagadas });
                    setRecentReqs(data.slice(0, 5)); // Solo las 5 más recientes

                    // Top Ures
                    const conteoUres = {};
                    data.forEach(req => { const ure = req.ure_solicitante || "General"; conteoUres[ure] = (conteoUres[ure] || 0) + 1; });
                    const top3 = Object.entries(conteoUres).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 4);
                    setTopUres(top3);
                }
            } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
        };
        fetchData();
    }, [coordinadorId]);

    // --- FUNCIONES MODAL ---
    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setModalItems([]); 
        setLoadingItems(true);
        try {
            const res = await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/items`);
            if (res.ok) { const data = await res.json(); setModalItems(data); }
        } catch (error) { console.error(error); } finally { setLoadingItems(false); }
    };

    const handleApprove = (req) => {
        MySwal.fire({
            title: `¿Autorizar Folio #${req.id}?`,
            text: "Se enviará a Secretaría.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, autorizar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/estatus`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status_id: 9, comentarios: "Autorizado desde Dashboard" })
                    });
                    await MySwal.fire('¡Autorizado!', 'El dashboard se actualizará.', 'success');
                    window.location.reload(); 
                } catch (error) { console.error(error); }
            }
        });
    };

    const handleReject = async (req, reason) => {
        try {
            await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status_id: 10, comentarios: reason })
            });
            await MySwal.fire('Rechazada', 'La solicitud ha sido rechazada.', 'success');
            window.location.reload();
        } catch (error) { console.error(error); }
    };

    return (
        <div className="space-y-6">
            <RequisitionModal req={selectedReq} items={modalItems} loadingItems={loadingItems} onClose={() => setSelectedReq(null)} onApprove={handleApprove} onReject={handleReject} />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pendientes</p><p className="text-3xl font-bold text-gray-800">{loading ? "-" : stats.pendientes}</p></div>
                    <div className="p-3 bg-yellow-50 rounded-full"><Clock className="w-6 h-6 text-yellow-600" /></div>
                </div>
                <div className={`p-6 rounded-xl border shadow-sm flex items-center justify-between ${stats.rezagadas > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                    <div><p className={`text-xs font-bold uppercase tracking-wider mb-1 ${stats.rezagadas > 0 ? "text-red-600" : "text-gray-400"}`}>Urgentes</p><p className={`text-3xl font-bold ${stats.rezagadas > 0 ? "text-red-700" : "text-gray-800"}`}>{loading ? "-" : stats.rezagadas}</p><p className="text-[10px] text-gray-500 mt-1">+3 días sin respuesta</p></div>
                    <div className={`p-3 rounded-full ${stats.rezagadas > 0 ? "bg-red-200" : "bg-gray-100"}`}><AlertTriangle className={`w-6 h-6 ${stats.rezagadas > 0 ? "text-red-700" : "text-gray-400"}`} /></div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Procesadas</p><p className="text-3xl font-bold text-gray-800">{loading ? "-" : stats.procesadas}</p></div>
                    <div className="p-3 bg-blue-50 rounded-full"><CheckCircle className="w-6 h-6 text-blue-600" /></div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Rechazadas</p><p className="text-3xl font-bold text-gray-800">{loading ? "-" : stats.rechazadas}</p></div>
                    <div className="p-3 bg-gray-100 rounded-full"><XCircle className="w-6 h-6 text-gray-500" /></div>
                </div>
            </div>

            {/* Tabla y Widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} className="text-gray-400"/> Actividad Reciente</h3>
                        <button onClick={() => navigate('/coordinador/requisiciones')} className="text-xs text-principal font-bold hover:underline">VER TODO</button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-100">
                                {recentReqs.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 group cursor-pointer transition-colors" onClick={() => handleRowClick(req)}>
                                        <td className="px-5 py-3"><span className="font-bold text-gray-700 text-sm">#{req.id}</span></td>
                                        <td className="px-5 py-3"><div className="text-sm font-medium text-gray-800 truncate w-32 md:w-auto">{req.request_name}</div><div className="text-xs text-gray-400">{req.solicitante}</div></td>
                                        
                                        {/* AQUI ESTA EL CAMBIO: USAMOS LA MISMA FUNCIÓN DE COLORES */}
                                        <td className="px-5 py-3 text-right">
                                            {renderStatusBadge(req.statuses_id, req.nombre_estatus)}
                                        </td>
                                    </tr>
                                ))}
                                {recentReqs.length === 0 && !loading && <tr><td colSpan="3" className="p-5 text-center text-sm text-gray-400">Sin actividad reciente</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col h-full">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-gray-400"/> Top Departamentos</h3>
                    <div className="space-y-4 flex-1">
                        {loading ? <p className="text-xs text-gray-400">Calculando...</p> : topUres.length === 0 ? <p className="text-xs text-gray-400">No hay datos</p> : 
                            topUres.map((ure, index) => {
                                const totalGlobal = stats.pendientes + stats.procesadas + stats.rechazadas;
                                const porcentaje = totalGlobal > 0 ? (ure.total / totalGlobal) * 100 : 0;
                                return (
                                    <div key={index} className="w-full">
                                        <div className="flex justify-between items-center text-sm mb-1 w-full"><span className="font-medium text-gray-600 truncate flex-1 pr-2" title={ure.nombre}>{ure.nombre}</span><span className="font-bold text-gray-800 whitespace-nowrap text-xs">{ure.total} reqs</span></div>
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className="bg-principal h-2 rounded-full opacity-80" style={{ width: `${porcentaje}%` }}></div></div>
                                    </div>
                                );
                            })
                        }
                    </div>
                    <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100"><p className="text-xs text-blue-800 text-center">💡 <strong>Tip:</strong> Revisa el presupuesto de las áreas con mayor demanda.</p></div>
                </div>
            </div>
        </div>
    );
}