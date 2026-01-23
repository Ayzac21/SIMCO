import React, { useEffect, useState } from "react";
import { FileText, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

// --- IMPORTANTE: La ruta al Modal del Coordinador ---
import RequisitionModal from "../../coordinador/requisiciones/RequisitionModal"; 

const MySwal = withReactContent(Swal);

// --- FUNCIÓN PARA LOS BADGES DE COLORES (Igual al Coordinador) ---
const renderStatusBadge = (statusId, statusName) => {
    let styles = "bg-gray-100 text-gray-600 border-gray-200";
    switch (statusId) {
        case 8: styles = "bg-yellow-50 text-yellow-700 border-yellow-200"; break; // Coordinacion
        case 9: styles = "bg-blue-50 text-blue-700 border-blue-200"; break; // Secretaria (Nosotros)
        case 10: styles = "bg-red-50 text-red-700 border-red-200"; break; // Rechazado
        case 12: styles = "bg-orange-50 text-orange-700 border-orange-200"; break; // Cotizacion
        case 11: styles = "bg-green-50 text-green-700 border-green-200"; break; // Comprado
        default: break;
    }
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold border ${styles} inline-flex items-center gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-50`}></span>
            {statusName || "Sin Estatus"}
        </span>
    );
};

export default function SecDashboard() {
    const [reqs, setReqs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para el Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Obtener usuario
    const userId = localStorage.getItem("users_id");

    // --- CARGAR DATOS ---
    const fetchData = async () => {
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:4000/api/secretaria/${userId}/recibidas`);
            if (res.ok) {
                const data = await res.json();
                setReqs(data);
            }
        } catch (error) {
            console.error("Error cargando dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userId]);

    // --- ABRIR MODAL Y CARGAR ITEMS ---
    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setModalItems([]);
        setLoadingItems(true);
        try {
            // Reutilizamos el endpoint de items (es el mismo para todos)
            const res = await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/items`);
            if (res.ok) {
                const data = await res.json();
                setModalItems(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingItems(false);
        }
    };

    // --- AUTORIZAR (Pasa a Estatus 12 - En Cotización) ---
    const handleApprove = (req) => {
        MySwal.fire({
            title: `¿Autorizar Presupuesto?`,
            text: `Folio #${req.id} pasará al área de Compras/Cotización.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, Autorizar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/estatus`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            status_id: 12, // ID 12 = En Cotización 
                            comentarios: "Presupuesto autorizado por Secretaría" 
                        })
                    });
                    await MySwal.fire('¡Autorizado!', 'La solicitud ha sido enviada a compras.', 'success');
                    fetchData(); // Recargar tabla
                    setSelectedReq(null); // Cerrar modal
                } catch (error) {
                    console.error(error);
                    MySwal.fire('Error', 'No se pudo actualizar la solicitud', 'error');
                }
            }
        });
    };

    // --- RECHAZAR (Pasa a Estatus 10) ---
    const handleReject = async (req, reason) => {
        try {
            await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status_id: 10, comentarios: reason })
            });
            await MySwal.fire('Rechazada', 'La solicitud ha sido rechazada.', 'success');
            fetchData();
            setSelectedReq(null);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            {/* MODAL */}
            <RequisitionModal 
                req={selectedReq} 
                items={modalItems} 
                loadingItems={loadingItems} 
                onClose={() => setSelectedReq(null)} 
                onApprove={handleApprove} 
                onReject={handleReject}
                approveText="Autorizar Presupuesto" 
            />

            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Panel de Secretaría</h2>
                    <p className="text-gray-500 text-sm">Validación de presupuesto y control administrativo</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                    📅 {new Date().toLocaleDateString()}
                </div>
            </div>

            {/* TARJETAS DE RESUMEN (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Por Validar</p>
                        <p className="text-3xl font-bold text-gray-800">{reqs.length}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-full"><Clock className="w-6 h-6 text-blue-600" /></div>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 border-dashed flex items-center justify-center text-gray-400 text-sm">
                   Métricas de presupuesto (Próximamente)
                </div>
            </div>

            {/* TABLA DE SOLICITUDES ENTRANTES */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign size={18} className="text-gray-400"/> Solicitudes por Autorizar
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-5 py-3">Folio</th>
                                <th className="px-5 py-3">Descripción</th>
                                <th className="px-5 py-3">Solicitante</th>
                                <th className="px-5 py-3">Fecha</th>
                                <th className="px-5 py-3 text-right">Estatus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400">Cargando...</td></tr>
                            ) : reqs.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400">No hay solicitudes pendientes de validación.</td></tr>
                            ) : (
                                reqs.map((req) => (
                                    <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                                        <td className="px-5 py-4 font-bold text-gray-700">#{req.id}</td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm font-medium text-gray-800">{req.request_name}</div>
                                            <div className="text-xs text-gray-400 truncate max-w-[200px]">{req.observaciones || "Sin observaciones previas"}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-gray-700">{req.solicitante}</div>
                                            <div className="text-xs text-gray-400">{req.ure_solicitante}</div>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-gray-500">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            {renderStatusBadge(req.statuses_id, req.nombre_estatus)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}