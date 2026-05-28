import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
    Search, ChevronLeft, ChevronRight,
    User,
    CheckCircle, XCircle, Clock, Truck, Building2, RefreshCw
} from "lucide-react";
import { toast } from 'sonner';
import SecModal from "./dashboard/SecModal"; // Usamos tu mismo modal
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";
import useEscapeKey from "../../hooks/useEscapeKey";
import { getRequisitionUnitLabel } from "../../utils/unitDisplay";
import { getStatusLabel } from "../../utils/statusDisplay";

function AppLoader({ label = "Cargando..." }) {
    return (
        <div className="flex-col gap-4 w-full flex items-center justify-center py-10">
            <div className="w-20 h-20 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
                <div className="w-16 h-16 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
            </div>
            <div className="text-xs text-gray-500 mt-2">{label}</div>
        </div>
    );
}

export default function SecRecibidas() {
    const location = useLocation();
    const navigate = useNavigate();
    // --- ESTADOS ---
    const [allReqs, setAllReqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("todos"); // todos, pendientes, aprobadas, rechazadas
    const [tabCounts, setTabCounts] = useState({ todos: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Estados para el Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [modalItems, setModalItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Estado para confirmar acción (copiado del dashboard para que funcione igual)
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, req: null, motivo: '' });
    useEscapeKey(confirmDialog.isOpen, () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })));

    const userId = localStorage.getItem("users_id");

    // --- CARGAR DATOS ---
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchData = async ({ showRefresh = false } = {}) => {
        if (!userId) return;
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        const t0 = Date.now();
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(itemsPerPage),
                q: searchTerm.trim(),
                status: statusFilter,
            });
            const res = await fetch(`${API_BASE_URL}/secretaria/${userId}/recibidas?${params.toString()}`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setAllReqs(Array.isArray(data?.rows) ? data.rows : []);
                setTotal(Number(data?.total || 0));
            }

            const baseParams = { page: "1", limit: "1", q: searchTerm.trim() };
            const statusKeys = ["todos", "pendientes", "aprobadas", "rechazadas"];
            const countEntries = await Promise.all(
                statusKeys.map(async (st) => {
                    try {
                        const p = new URLSearchParams({ ...baseParams, status: st });
                        const rr = await fetch(`${API_BASE_URL}/secretaria/${userId}/recibidas?${p.toString()}`, {
                            headers: getAuthHeaders(),
                        });
                        const dd = await rr.json().catch(() => ({}));
                        return [st, Number(dd?.total || 0)];
                    } catch {
                        return [st, 0];
                    }
                })
            );
            setTabCounts(Object.fromEntries(countEntries));
        } catch (error) {
            console.error("Error:", error);
            toast.error("Error al cargar requisiciones");
        } finally {
            const elapsed = Date.now() - t0;
            const minMs = showRefresh ? 1200 : 600;
            if (elapsed < minMs) await sleep(minMs - elapsed);
            if (showRefresh) setRefreshing(false);
            else setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, currentPage, statusFilter, searchTerm]);

    // --- FILTROS Y BÚSQUEDA ---
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    const startItem = total === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, total);

    // --- LOGICA DEL MODAL (Abrir detalles) ---
    const handleRowClick = async (req) => {
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
        } catch {
            toast.error("Error al cargar items");
        } finally {
            setLoadingItems(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search || "");
        const openReq = Number(params.get("openReq") || 0);
        if (!openReq) return;
        if (!allReqs.length) return;

        const row = allReqs.find((r) => Number(r.id) === openReq);
        if (!row) return;

        handleRowClick(row);
        navigate("/secretaria/recibidas", { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, allReqs]);

    // --- LOGICA DE ACCIÓN (Autorizar/Rechazar) ---
    // Esto es necesario para que el modal funcione en esta pantalla también
    const initiateAction = (type, req) => {
        setConfirmDialog({ isOpen: true, type, req, motivo: '' });
    };

    const executeAction = async () => {
        const { type, req, motivo } = confirmDialog;
        if (!req) return;
        const needsComment = type === 'reject' || type === 'adjust';
        if (needsComment && !motivo.trim()) {
            toast.error(
                type === 'adjust'
                    ? "Debes escribir qué se debe corregir antes de continuar."
                    : "Debes escribir un motivo para rechazar."
            );
            return;
        }

        setConfirmDialog({ ...confirmDialog, isOpen: false }); // Cierra dialogo pequeño
        const toastId = toast.loading("Procesando...");
        
        try {
            const statusId = type === 'approve' ? 12 : type === 'adjust' ? 8 : 10;
            const comentarios =
                type === 'approve'
                    ? "Autorizado por Secretaría"
                    : type === 'adjust'
                    ? `AJUSTE_SECRETARIA: ${motivo}`
                    : motivo;
            
            const res = await fetch(`${API_BASE_URL}/secretaria/requisiciones/${req.id}/estatus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ status_id: statusId, comentarios })
            });

            if (res.ok) {
                toast.success(
                    type === 'approve'
                        ? "¡Autorizado!"
                        : type === 'adjust'
                        ? "Enviada a revisión"
                        : "Cancelada",
                    { id: toastId }
                );
                setSelectedReq(null); // Cierra el modal grande
                fetchData(); // Recarga la lista completa
            } else {
                throw new Error();
            }
        } catch {
            toast.error("Error al procesar", { id: toastId });
        }
    };

    const getReqLabel = (req) => {
        const candidates = [
            req?.request_name,
            req?.nombre_solicitud,
            req?.categoria,
            req?.category_name,
        ];
        for (const value of candidates) {
            const clean = String(value || "").trim();
            if (clean) return clean;
        }
        const id = Number(req?.id || 0);
        return id ? `Requisición #${id}` : "Requisición";
    };

    // --- RENDERIZADO DE BADGES ---
    const renderStatusBadge = (statusId) => {
        const sid = Number(statusId);
        const label = getStatusLabel(statusId);
        switch(sid) {
            case 9: return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Clock size={10} /> {label}</span>;
            case 12: return <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Truck size={10} /> {label}</span>;
            case 14: return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Clock size={10} /> {label}</span>;
            case 13: return <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Truck size={10} /> {label}</span>;
            case 15: return <span className="bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Clock size={10} /> {label}</span>;
            case 16: return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle size={10} /> {label}</span>;
            case 17: return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle size={10} /> {label}</span>;
            case 11: return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle size={10} /> {label}</span>;
            case 10: return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle size={10} /> {label}</span>;
            default: return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit"><Clock size={10} /> {label}</span>;
        }
    };

    return (
        <div className="relative space-y-6 animate-in fade-in duration-500 pb-10">
            {refreshing && (
                <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                    <AppLoader label="Actualizando..." />
                </div>
            )}
            
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
                    onClick={() => fetchData({ showRefresh: true })}
                    disabled={refreshing || loading}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 ${
                        refreshing || loading
                            ? "bg-[#8B1D35]/70 cursor-not-allowed"
                            : "bg-[#8B1D35] hover:bg-[#72182b]"
                    }`}
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Actualizando..." : "Recargar"}
                </button>
            </div>

            {/* 2. PESTAÑAS (TABS) */}
            <div className="flex gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
                {[
                    { id: 'todos', label: 'Todas' },
                    { id: 'pendientes', label: 'Por Validar' },
                    { id: 'aprobadas', label: 'Autorizadas / En Proceso' },
                    { id: 'rechazadas', label: 'Canceladas' }
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
                        <span className="inline-flex items-center gap-1.5">
                            {tab.label}
                            <span
                                className={`min-w-5 px-1.5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold ${
                                    statusFilter === tab.id
                                        ? "bg-[#8B1D35]/10 text-[#8B1D35]"
                                        : "bg-gray-200 text-gray-600"
                                }`}
                            >
                                {Number(tabCounts[tab.id] || 0)}
                            </span>
                        </span>
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
                            ) : allReqs.length === 0 ? (
                                <tr><td colSpan="6" className="p-12 text-center text-gray-400">No se encontraron resultados</td></tr>
                            ) : (
                                allReqs.map((req) => (
                                    <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-gray-50 cursor-pointer group transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-700">#{req.id}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 text-sm mb-1">{getReqLabel(req)}</div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10 flex items-center gap-1">
                                                    <Building2 size={10} /> {getRequisitionUnitLabel(req, "Unidad solicitante")}
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
                                            <div className="flex flex-col items-center gap-1">
                                                {renderStatusBadge(req.statuses_id)}
                                                {Number(req.statuses_id) === 10 && (
                                                    <span className="text-[10px] text-red-700 font-semibold">
                                                        Por: {req.rejected_by_name || "N/D"}
                                                    </span>
                                                )}
                                            </div>
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
                {!loading && allReqs.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <span className="text-xs text-gray-500 font-medium">
                            Mostrando {startItem} - {endItem} de {total}
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
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6">
                        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                            confirmDialog.type === "approve"
                                ? "bg-secundario/10 text-secundario"
                                : confirmDialog.type === "adjust"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-600"
                        }`}>
                            {confirmDialog.type === "approve" ? <CheckCircle size={24} /> : <XCircle size={24} />}
                        </div>

                        <h3 className="font-bold text-gray-800 text-lg mb-2 text-center">
                            {confirmDialog.type === "approve"
                                ? "¿Autorizar solicitud?"
                                : confirmDialog.type === "adjust"
                                ? "¿Enviar a revisión?"
                                : "¿Rechazar solicitud?"}
                        </h3>

                        {confirmDialog.type === "reject" || confirmDialog.type === "adjust" ? (
                            <div
                                className={`p-4 rounded-xl border mb-4 ${
                                    confirmDialog.type === "adjust"
                                        ? "bg-amber-50 border-amber-200"
                                        : "bg-red-50 border-red-200"
                                }`}
                            >
                                <p
                                    className={`text-xs mb-2 font-semibold ${
                                        confirmDialog.type === "adjust" ? "text-amber-800" : "text-red-700"
                                    }`}
                                >
                                    {confirmDialog.type === "adjust"
                                        ? "Describe los ajustes requeridos. La requisición regresará al solicitante para edición."
                                        : "Indica el motivo del rechazo de la requisición."}
                                </p>
                                <textarea
                                    className={`w-full text-sm p-3 border rounded-lg outline-none resize-none bg-white ${
                                        confirmDialog.type === "adjust"
                                            ? "border-amber-300 focus:ring-2 focus:ring-amber-200"
                                            : "border-red-300 focus:ring-2 focus:ring-red-200"
                                    }`}
                                    rows="3"
                                    placeholder={
                                        confirmDialog.type === "adjust"
                                            ? "Ejemplo: validar especificación técnica de la partida 2 antes de continuar."
                                            : "Escribe aquí por qué se rechaza..."
                                    }
                                    value={confirmDialog.motivo}
                                    onChange={(e) => setConfirmDialog({ ...confirmDialog, motivo: e.target.value })}
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm mb-6 text-center">
                                La solicitud pasará al departamento de Compras.
                            </p>
                        )}

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                            <button
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                                className="flex-1 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeAction}
                                disabled={(confirmDialog.type === "reject" || confirmDialog.type === "adjust") && !confirmDialog.motivo.trim()}
                                className={`flex-1 py-2.5 rounded-lg font-bold text-white shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                                    confirmDialog.type === "approve"
                                        ? "bg-[#8B1D35] hover:bg-[#72182b]"
                                        : confirmDialog.type === "adjust"
                                        ? "bg-amber-600 hover:bg-amber-700"
                                        : "bg-red-600 hover:bg-red-700"
                                }`}
                            >
                                {confirmDialog.type === "approve"
                                    ? "Confirmar"
                                    : confirmDialog.type === "adjust"
                                    ? "Enviar a revisión"
                                    : "Rechazar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
