import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequisitionModal from "./RequisitionModal";

// --- 1. IMPORTAMOS SWEETALERT ---
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// --- Helpers Visuales ---
const IconSearch = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
    </svg>
);

// --- FUNCIÓN DE COLORES POR ID ---
const renderStatusBadge = (statusId, statusName) => {
    let styles = "bg-gray-100 text-gray-600 border-gray-200"; 

    switch (statusId) {
        case 8: styles = "bg-yellow-50 text-yellow-700 border-yellow-200"; break; // En coordinación
        case 9: styles = "bg-blue-50 text-blue-700 border-blue-200"; break; // En secretaría
        case 10: styles = "bg-red-50 text-red-700 border-red-200"; break; // Rechazado
        case 12: styles = "bg-orange-50 text-orange-700 border-orange-200"; break; // En cotización
        case 11: 
        case 13: styles = "bg-green-50 text-green-700 border-green-200"; break; // Comprado / Proceso
        default: break;
    }

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles} inline-flex items-center gap-1`}>
            <span className={`w-2 h-2 rounded-full bg-current opacity-50`}></span>
            {statusName || "Sin Estatus"}
        </span>
    );
};

export default function Recibidas() {
    const navigate = useNavigate();
    
    // Estados principales
    const [requisiciones, setRequisiciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Estados para el Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [items, setItems] = useState([]); 
    const [loadingItems, setLoadingItems] = useState(false);

    const storageId = localStorage.getItem("users_id"); 

    // Cargar lista principal
    useEffect(() => {
        if (!storageId) { navigate("/"); return; }

        const fetchRecibidas = async () => {
            setLoading(true);
            try {
                const res = await fetch(`http://localhost:4000/api/coordinador/${storageId}/recibidas`);
                if (res.ok) {
                    const data = await res.json();
                    setRequisiciones(Array.isArray(data) ? data : []);
                }
            } catch (err) { console.error(err); } 
            finally { setLoading(false); }
        };
        fetchRecibidas();
    }, [storageId, navigate]);

    // --- AL DAR CLICK EN UNA FILA ---
    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setItems([]); 
        setLoadingItems(true);
        try {
            const res = await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/items`);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) { console.error("Error cargando items:", error); } 
        finally { setLoadingItems(false); }
    };

    // --- 2. AUTORIZAR (SweetAlert + Actualización Local) ---
    const handleApprove = (req) => {
        MySwal.fire({
            title: `¿Autorizar Folio #${req.id}?`,
            text: "La solicitud pasará a Secretaría para su revisión.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981', // Verde
            cancelButtonColor: '#6B7280',  // Gris
            confirmButtonText: 'Sí, autorizar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/estatus`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status_id: 9, comentarios: "Autorizado por Coordinación" })
                    });

                    if (res.ok) {
                        MySwal.fire('¡Autorizado!', 'La solicitud ha sido enviada a Secretaría.', 'success');
                        
                        // ACTUALIZACIÓN OPTIMISTA: Quitamos la fila de la lista sin recargar la página
                        setRequisiciones(prev => prev.filter(r => r.id !== req.id));
                        setSelectedReq(null); // Cerramos el modal
                    } else {
                        throw new Error();
                    }
                } catch (error) { 
                    MySwal.fire('Error', 'No se pudo procesar la solicitud', 'error');
                }
            }
        });
    };

    // --- 3. RECHAZAR (SweetAlert + Actualización Local) ---
    const handleReject = async (req, reason) => {
        try {
            const res = await fetch(`http://localhost:4000/api/coordinador/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status_id: 10, comentarios: reason })
            });

            if (res.ok) {
                MySwal.fire('Rechazada', 'La solicitud ha sido marcada como rechazada.', 'success');
                
                // ACTUALIZACIÓN OPTIMISTA
                setRequisiciones(prev => prev.filter(r => r.id !== req.id));
                setSelectedReq(null);
            }
        } catch (error) { 
            console.error(error);
            MySwal.fire('Error', 'Ocurrió un error al rechazar', 'error');
        }
    };

    const filteredReqs = requisiciones.filter(req => 
        req.solicitante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.request_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#F3F4F6]">
            
            {/* MODAL */}
            <RequisitionModal 
                req={selectedReq} 
                items={items}               
                loadingItems={loadingItems} 
                onClose={() => setSelectedReq(null)} 
                onApprove={handleApprove}
                onReject={handleReject}
            />

            <main className="flex-1 p-2 md:p-6 overflow-hidden flex flex-col w-full">
                {/* Buscador */}
                <div className="mb-6 w-full md:w-96 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconSearch /></div>
                    <input 
                        type="text"
                        placeholder="Buscar..."
                        className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-principal/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Tabla */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-2 md:col-span-1">Folio</div>
                        <div className="col-span-4 md:col-span-3">Solicitante</div>
                        <div className="col-span-6 md:col-span-4">Asunto</div>
                        <div className="col-span-2 hidden md:block text-center">Fecha</div>
                        <div className="col-span-2 hidden md:block text-center">Estatus</div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? <div className="p-10 text-center text-gray-400">Cargando...</div> : 
                            filteredReqs.length === 0 ? <div className="p-10 text-center text-gray-400">No se encontraron solicitudes.</div> :
                            filteredReqs.map((req) => (
                            <div 
                                key={req.id}
                                onClick={() => handleRowClick(req)} 
                                className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 items-center hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                <div className="col-span-2 md:col-span-1 font-bold text-gray-700 text-sm">#{req.id}</div>
                                <div className="col-span-4 md:col-span-3 truncate">
                                    <p className="font-semibold text-gray-800 text-sm">{req.solicitante}</p>
                                    <p className="text-xs text-gray-500">{req.ure_solicitante}</p>
                                </div>
                                <div className="col-span-6 md:col-span-4 font-medium text-gray-700 text-sm truncate">{req.request_name}</div>
                                <div className="col-span-2 hidden md:block text-center text-sm text-gray-500">
                                    {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                </div>
                                
                                <div className="col-span-2 hidden md:block text-center flex justify-center">
                                    {renderStatusBadge(req.statuses_id, req.nombre_estatus)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}