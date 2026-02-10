import React, { useEffect, useState, useMemo } from "react";
import { 
    Search, Filter, ChevronLeft, ChevronRight, 
    FileText, User, Calendar, Briefcase, 
    CheckCircle, XCircle, Clock, Truck, Building2 
} from "lucide-react";
import { toast } from 'sonner';
import SecModal from "./dashboard/SecModal"; // Usamos tu mismo modal

function AppLoader({ label = "Cargando..." }) {
    return (
        <div className="flex-col gap-4 w-full flex items-center justify-center py-8">
            <div className="w-12 h-12 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
                <div className="w-8 h-8 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
        </div>
    );
}

export default function SecRecibidas() {
    // --- ESTADOS ---
    const [allReqs, setAllReqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("todos"); // todos, pendientes, aprobadas, rechazadas
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Estados para el Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Estado para confirmar acción (copiado del dashboard para que funcione igual)
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, req: null, motivo: '' });

    const userId = localStorage.getItem("users_id");

    // --- CARGAR DATOS ---
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchData = async () => {
        if (!userId) return;
        setLoading(true);
        const t0 = Date.now();
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(itemsPerPage),
                q: searchTerm.trim(),
                status: statusFilter,
            });
            const res = await fetch(`http://localhost:4000/api/secretaria/${userId}/recibidas?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAllReqs(Array.isArray(data?.rows) ? data.rows : []);
                setTotal(Number(data?.total || 0));
            }
        } catch (error) {
            console.error("Error:", error);
            toast.error("Error al cargar requisiciones");
        } finally {
            const elapsed = Date.now() - t0;
            if (elapsed < 600) await sleep(600 - elapsed);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, currentPage, statusFilter, searchTerm]);

    // --- FILTROS Y BÚSQUEDA ---
    const filteredReqs = useMemo(() => allReqs, [allReqs]);

    // --- PAGINACIÓN ---
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const paginatedReqs = filteredReqs.slice(
        0,
        filteredReqs.length
    );

    // --- LOGICA DEL MODAL (Abrir detalles) ---
    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setModalItems([]);
        setLoadingItems(true);
        try {
            const res = await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/items`);
            if (res.ok) {
                const data = await res.json();
                setModalItems(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            toast.error("Error al cargar items");
        } finally {
            setLoadingItems(false);
        }
    };

    // --- LOGICA DE ACCIÓN (Autorizar/Rechazar) ---
    // Esto es necesario para que el modal funcione en esta pantalla también
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

        setConfirmDialog({ ...confirmDialog, isOpen: false }); // Cierra dialogo pequeño
        const toastId = toast.loading("Procesando...");
        
        try {
            const statusId = type === 'approve' ? 12 : 10;
            const comentarios = type === 'approve' ? "Autorizado por Secretaría" : motivo;
            
            const res = await fetch(`http://localhost:4000/api/secretaria/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status_id: statusId, comentarios })
            });

            if (res.ok) {
                toast.success(type === 'approve' ? "¡Autorizado!" : "Rechazada", { id: toastId });
                setSelectedReq(null); // Cierra el modal grande
                fetchData(); // Recarga la lista completa
            } else {
                throw new Error();
            }
        } catch (error) {
            toast.error("Error al procesar", { id: toastId });
        }
    };

    // --- RENDERIZADO DE BADGES ---
    const renderStatusBadge = (statusId) => {
        switch(statusId) {
            case 9: return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Clock size={10} /> En Revisión</span>;
            case 12: return <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Truck size={10} /> En Compras</span>;
            case 10: return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle size={10} /> Rechazada</span>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            
            {/* 1. TÍTULO Y BUSCADOR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Historial de Requisiciones</h1>
                    <p className="text-sm text-gray-500">Consulta y gestiona todas las solicitudes recibidas.</p>
                </div>
                
                {/* Barra de Búsqueda */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por folio, nombre, área..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1D35]/20 focus:border-[#8B1D35] transition-all"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <button
                    onClick={() => fetchData()}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#8B1D35] text-white hover:bg-[#72182b] transition-all"
                >
                    Recargar
                </button>
            </div>

            {/* 2. PESTAÑAS (TABS) */}
            <div className="flex gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
                {[
                    { id: 'todos', label: 'Todas' },
                    { id: 'pendientes', label: 'Por Validar' },
                    { id: 'aprobadas', label: 'En Compras' },
                    { id: 'rechazadas', label: 'Rechazadas' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            statusFilter === tab.id 
                            ? 'bg-white text-[#8B1D35] shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 3. TABLA PRINCIPAL */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 w-20">Folio</th>
                                <th className="px-6 py-4">Proyecto / Área</th>
                                <th className="px-6 py-4">Solicitante</th>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4 text-center">Estatus</th>
                                <th className="px-6 py-4 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan="6"><AppLoader label="Cargando..." /></td></tr>
                            ) : paginatedReqs.length === 0 ? (
                                <tr><td colSpan="6" className="p-12 text-center text-gray-400">No se encontraron resultados</td></tr>
                            ) : (
                                paginatedReqs.map((req) => (
                                    <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-gray-50 cursor-pointer group transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-700">#{req.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 text-sm mb-1">{req.request_name}</div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10 flex items-center gap-1">
                                                    <Building2 size={10} /> {req.nombre_unidad || req.ure_solicitante}
                                                </span>
                                                {req.coordinacion && req.coordinacion !== "General" && (
                                                    <span className="text-[10px] text-gray-500 font-semibold">
                                                        ↳ {req.coordinacion}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                    <User size={12}/>
                                                </div>
                                                {req.solicitante}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 flex justify-center">
                                            {renderStatusBadge(req.statuses_id)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-gray-300 group-hover:text-[#8B1D35] transition-colors">
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN FOOTER */}
                {paginatedReqs.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <span className="text-xs text-gray-500 font-medium">
                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredReqs.length)} de {filteredReqs.length}
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- INTEGRACIÓN DE MODALES --- */}

            {/* 1. Modal Detalle (El mismo que usas en dashboard) */}
            {selectedReq && (
                <SecModal 
                    req={selectedReq} 
                    items={modalItems} 
                    loadingItems={loadingItems} 
                    onClose={() => setSelectedReq(null)} 
                    onAction={initiateAction} 
                />
            )}

            {/* 2. Diálogo Confirmación (El mismo que usas en dashboard) */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
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
                            <p className="text-gray-500 text-sm mb-6">La solicitud pasará a compras.</p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="flex-1 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 text-sm">Cancelar</button>
                            <button 
                                onClick={executeAction} 
                                disabled={confirmDialog.type === 'reject' && !confirmDialog.motivo.trim()}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-white shadow-md text-sm ${
                                    confirmDialog.type === 'approve' ? 'bg-[#8B1D35] hover:bg-[#72182b]' : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {confirmDialog.type === 'approve' ? 'Confirmar' : 'Rechazar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
