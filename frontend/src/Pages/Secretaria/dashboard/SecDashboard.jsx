import React, { useEffect, useState, useMemo } from "react";
import { 
    Clock, CheckCircle, XCircle, BarChart3, FileText,
    Truck, ArrowRight, User, Briefcase, AlertTriangle, Lightbulb, RefreshCw
} from "lucide-react";
import { toast } from 'sonner'; 
import { useNavigate } from "react-router-dom"; 
import SecModal from "./SecModal"; 
import { getAuthHeaders } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";
import useEscapeKey from "../../../hooks/useEscapeKey";
import { getRequisitionUnitLabel } from "../../../utils/unitDisplay";
import { getStatusLabel } from "../../../utils/statusDisplay";

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

export default function SecDashboard() {
    // --- ESTADO ---
    const [allReqs, setAllReqs] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
    useEscapeKey(confirmDialog.isOpen, () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })));

    const navigate = useNavigate(); 
    const userId = localStorage.getItem("users_id");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // --- CARGAR DATOS ---
    const fetchData = async ({ showRefresh = false } = {}) => {
        if (!userId) {
            if (!showRefresh) setLoading(false);
            return;
        }
        const t0 = Date.now();
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
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
                setAllReqs(Array.isArray(data?.rows) ? data.rows : []);
            } else {
                setAllReqs([]);
            }
        } catch {
            setAllReqs([]);
        } finally {
            const elapsed = Date.now() - t0;
            const minMs = showRefresh ? 1000 : 500;
            if (elapsed < minMs) await sleep(minMs - elapsed);
            if (showRefresh) setRefreshing(false);
            else setLoading(false);
        }
    };

    useEffect(() => {
        fetchData({ showRefresh: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // --- CÁLCULOS ---
    const { pendientes, procesadas, rechazadas, urgentes } = useMemo(() => {
        const safeReqs = Array.isArray(allReqs) ? allReqs : [];
        const now = Date.now();
        const urgentThresholdMs = 48 * 60 * 60 * 1000;
        const pendingReqs = safeReqs.filter(r => Number(r.statuses_id) === 9);
        return {
            pendientes: pendingReqs,
            procesadas: safeReqs.filter(r => [12, 13, 14, 11].includes(Number(r.statuses_id))),
            rechazadas: safeReqs.filter(r => Number(r.statuses_id) === 10),
            urgentes: pendingReqs.filter((r) => {
                const created = new Date(r.created_at).getTime();
                return Number.isFinite(created) && now - created >= urgentThresholdMs;
            }),
        };
    }, [allReqs]);

    const topDepts = useMemo(() => {
        if (!Array.isArray(allReqs) || allReqs.length === 0) return [];
        const counts = {};
        allReqs.forEach(req => {
            const dept = getRequisitionUnitLabel(req, "Unidad solicitante");
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).sort(([,a], [,b]) => b - a).slice(0, 3).map(([name, count]) => ({ name, count }));
    }, [allReqs]);
    
    const maxCount = topDepts.length > 0 ? topDepts[0].count : 1;

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
        } catch { toast.error("Error al cargar items"); } 
        finally { setLoadingItems(false); }
    };

    const initiateAction = (type, req) => {
        setConfirmDialog({ isOpen: true, type, req, motivo: '' });
    };

    const executeAction = async () => {
        const { type, req, motivo } = confirmDialog;
        if (!req) return;
        const isComprasOrigin = String(req?.solicitante_role || "").startsWith("compras_");

        const needsComment = type === 'reject' || type === 'adjust';
        if (needsComment && !motivo.trim()) {
            toast.error(
                type === 'adjust'
                    ? `Debes escribir qué debe revisar ${isComprasOrigin ? "Compras" : "Coordinación"}.`
                    : "Debes escribir un motivo para rechazar."
            );
            return;
        }

        setConfirmDialog({ ...confirmDialog, isOpen: false });
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
                        ? `Reenviada a ${isComprasOrigin ? "Compras" : "Coordinación"} para revisión`
                        : "Cancelada",
                    { id: toastId }
                );
                setSelectedReq(null);
                await fetchData({ showRefresh: false });
            } else { throw new Error(); }
        } catch { toast.error("Error al procesar", { id: toastId }); }
    };

    const renderStatusBadge = (statusId) => {
        const sid = Number(statusId);
        const label = getStatusLabel(statusId);
        switch(sid) {
            case 9: return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Clock size={10} /> {label}</span>;
            case 12: return <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Truck size={10} /> {label}</span>;
            case 14: return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Clock size={10} /> {label}</span>;
            case 13: return <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><Truck size={10} /> {label}</span>;
            case 11: return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><CheckCircle size={10} /> {label}</span>;
            case 10: return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ml-auto"><XCircle size={10} /> {label}</span>;
            default: return (
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-[10px] font-bold w-fit ml-auto">
                    {label}
                </span>
            );
        }
    };

    if (loading) return <AppLoader />;

    return (
        <div className="relative space-y-6 animate-in fade-in duration-500 pb-10">
            {refreshing && !loading && (
                <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                    <AppLoader label="Actualizando..." />
                </div>
            )}
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg md:text-xl font-extrabold text-gray-800">Dashboard de Secretaría</h1>
                <button
                    onClick={() => fetchData({ showRefresh: true })}
                    disabled={refreshing || loading}
                    className={`px-4 py-2 rounded-lg text-xs font-extrabold text-white bg-secundario inline-flex items-center gap-2 ${
                        refreshing || loading ? "opacity-70 cursor-not-allowed" : "hover:bg-secundario/90"
                    }`}
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Actualizando..." : "Actualizar"}
                </button>
            </div>

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
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
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
                                ? `¿Reenviar a ${String(confirmDialog.req?.solicitante_role || "").startsWith("compras_") ? "Compras" : "Coordinación"}?`
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
                                        ? (
                                            String(confirmDialog.req?.solicitante_role || "").startsWith("compras_")
                                                ? "Describe qué debe revisar Compras. La requisición regresará al usuario de Compras para edición."
                                                : "Describe qué debe revisar Coordinación. Si aplica, Coordinación la devolverá a URE para edición."
                                          )
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

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                                className="flex-1 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-sm"
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
                                    ? `Reenviar a ${String(confirmDialog.req?.solicitante_role || "").startsWith("compras_") ? "Compras" : "Coordinación"}`
                                    : "Rechazar"}
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
                    <div><p className="text-[10px] font-bold text-red-400 uppercase">Urgentes</p><p className="text-3xl font-bold text-red-600 mt-1">{urgentes.length}</p><p className="text-[10px] text-red-400 mt-1">Más de 48h en Secretaría</p></div>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600 h-fit"><AlertTriangle size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">En Compras</p><p className="text-3xl font-bold text-gray-800 mt-1">{procesadas.length}</p></div>
                    <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600 h-fit"><Truck size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Canceladas</p><p className="text-3xl font-bold text-gray-800 mt-1">{rechazadas.length}</p></div>
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
                                    const jefatura = getRequisitionUnitLabel(req, "Unidad solicitante");
                                    const coordinacion = req.coordinacion;

                                    return (
                                        <tr key={req.id} onClick={() => handleRowClick(req)} className="hover:bg-gray-50 cursor-pointer group transition-colors">
                                            <td className="px-6 py-4 align-top w-16">
                                                <span className="font-bold text-gray-700">#{req.id}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800 mb-1">{getReqLabel(req)}</div>
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10">
                                                        <Briefcase size={10} /> 
                                                        <span className="truncate max-w-[200px]">{jefatura}</span>
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
