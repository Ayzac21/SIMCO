import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, Clock, AlertTriangle, ShoppingCart, FileText, BarChart3, Lightbulb, Briefcase, User, RotateCw } from "lucide-react";
import { toast } from "sonner";
import RequisitionModal from "../requisiciones/RequisitionModal";
import { API_BASE_URL } from "../../../api/config";
import useEscapeKey from "../../../hooks/useEscapeKey";

const API = `${API_BASE_URL}/compras/dashboard`;
const API_OPERATORS = `${API_BASE_URL}/compras/operators`;
const API_ASSIGN = `${API_BASE_URL}/compras/requisiciones`;

const getAuthHeaders = () => {
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const token = localStorage.getItem("token");
    return {
        "x-user-id": String(user?.id || ""),
        "x-user-role": String(user?.role || ""),
        Authorization: token ? `Bearer ${token}` : "",
    };
};

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

export default function ComprasDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const [requisitions, setRequisitions] = useState([]);
    const [selectedReq, setSelectedReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState({ c12: 0, c14: 0, c13: 0, total: 0, high: 0 });
    const [operators, setOperators] = useState([]);
    const [assigningReq, setAssigningReq] = useState(null);
    const [assignOperatorId, setAssignOperatorId] = useState("");
    const [savingAssign, setSavingAssign] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    useEscapeKey(Boolean(assigningReq), () => {
        if (savingAssign) return;
        setAssigningReq(null);
        setAssignOperatorId("");
    }, savingAssign);

    const [tab, setTab] = useState("all"); // all | 12 | 14 | 13
    const [q, setQ] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState("newest");
    const [onlyUnassigned, setOnlyUnassigned] = useState(false);
    const [onlyHighPriority, setOnlyHighPriority] = useState(false);

    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role || "";
    const isAdmin = role === "compras_admin";
    const isOperator = role === "compras_operador";

    const fetchRequisitions = async ({ silent = false } = {}) => {
        try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        const params = new URLSearchParams({
            page: String(currentPage),
            limit: String(itemsPerPage),
            q: q.trim(),
            status: tab,
        });
        if (isOperator) {
            params.set("assigned_to", String(user?.id || ""));
        }
        const response = await fetch(`${API}?${params.toString()}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Error al cargar datos");
        const data = await response.json();
        setRequisitions(Array.isArray(data?.rows) ? data.rows : []);
        setTotal(Number(data?.total || 0));
        setCounts({
            c12: Number(data?.counts?.c12 || 0),
            c14: Number(data?.counts?.c14 || 0),
            c13: Number(data?.counts?.c13 || 0),
            total: Number(data?.counts?.total || 0),
            high: Number(data?.counts?.high || 0),
        });
        setLastUpdatedAt(new Date());
        } catch (error) {
        console.error(error);
        toast.error("Error al conectar con el servidor");
        } finally {
        setLoading(false);
        setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRequisitions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, q, currentPage, itemsPerPage]);

    useEffect(() => {
        const params = new URLSearchParams(location.search || "");
        const openReq = Number(params.get("openReq") || 0);
        if (!openReq) return;
        if (!requisitions.length) return;

        const row = requisitions.find((r) => Number(r.id) === openReq);
        if (!row) return;

        setSelectedReq(row);
        navigate("/compras/dashboard", { replace: true });
    }, [location.search, requisitions, navigate]);

    useEffect(() => {
        const loadOperators = async () => {
            try {
                const res = await fetch(API_OPERATORS, {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setOperators(Array.isArray(data) ? data : []);
            } catch {
                setOperators([]);
            }
        };
        if (isAdmin) loadOperators();
    }, [isAdmin]);

    const getAgeDays = (inComprasAt, createdAt) => {
        const time = new Date(inComprasAt || createdAt).getTime();
        if (!Number.isFinite(time)) return 0;
        const days = Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
    };

    const getComprasArrivalAt = (req) => req?.sent_on || req?.created_at || null;

    const ageLabel = (days) => {
        if (days <= 0) return "Hoy";
        if (days === 1) return "1 día";
        return `${days} días`;
    };

    const filtered = useMemo(() => {
        let rows = [...requisitions];

        if (onlyUnassigned) {
            rows = rows.filter((req) => !req.assigned_operator_id && !req.assigned_operator_name);
        }
        if (onlyHighPriority) {
            rows = rows.filter((req) => getAgeDays(req.sent_on, req.created_at) >= 7);
        }

        rows.sort((a, b) => {
            if (sortBy === "oldest") return new Date(getComprasArrivalAt(a)) - new Date(getComprasArrivalAt(b));
            if (sortBy === "name") return String(a.request_name || "").localeCompare(String(b.request_name || ""), "es");
            if (sortBy === "unit") return String(a.nombre_unidad || "").localeCompare(String(b.nombre_unidad || ""), "es");
            return new Date(getComprasArrivalAt(b)) - new Date(getComprasArrivalAt(a));
        });

        return rows;
    }, [requisitions, onlyUnassigned, onlyHighPriority, sortBy]);

    const topAreas = useMemo(() => {
        const counts = {};
        requisitions.forEach((req) => {
        const area = req.nombre_unidad || "Sin Unidad";
        counts[area] = (counts[area] || 0) + 1;
        });

        return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    }, [requisitions]);

    const maxCount = topAreas.length > 0 ? topAreas[0].count : 1;

    const badge = (st) => {
        if (Number(st) === 12) return { text: "POR COTIZAR", cls: "bg-orange-50 text-orange-600 border-orange-100" };
        if (Number(st) === 14) return { text: "EN REVISIÓN INTERNA", cls: "bg-[#8B1D35]/10 text-[#8B1D35] border-[#8B1D35]/10" };
        if (Number(st) === 13) return { text: "EN PROCESO", cls: "bg-blue-50 text-blue-600 border-blue-100" };
        return { text: "OTRO", cls: "bg-gray-100 text-gray-600 border-gray-200" };
    };

    const handleAssign = async () => {
        if (!assigningReq) return;
        if (!assignOperatorId) {
            toast.error("Selecciona un operador");
            return;
        }
        try {
            setSavingAssign(true);
            const res = await fetch(`${API_ASSIGN}/${assigningReq.id}/assign`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ assigned_operator_id: Number(assignOperatorId) }),
            });
            if (!res.ok) throw new Error();
            toast.success("Requisición asignada");
            setAssigningReq(null);
            setAssignOperatorId("");
            await fetchRequisitions({ silent: true });
        } catch {
            toast.error("Error al asignar");
        } finally {
            setSavingAssign(false);
        }
    };

    return (
        <div className="relative p-3 sm:p-5 lg:p-6 min-h-full bg-[#F3F4F6]">
        {assigningReq && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Asignar requisición</h3>
                <p className="text-xs text-gray-500 mb-4">
                #{assigningReq.id} • {assigningReq.request_name}
                </p>
                <label className="text-xs font-bold text-gray-600">Operador</label>
                <select
                    value={assignOperatorId}
                    onChange={(e) => setAssignOperatorId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                    <option value="">Seleccionar...</option>
                    {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                        {op.name || op.user_name}
                    </option>
                    ))}
                </select>
                <div className="flex justify-end gap-2 mt-5">
                <button
                    onClick={() => {
                        setAssigningReq(null);
                        setAssignOperatorId("");
                    }}
                    className="px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleAssign}
                    disabled={savingAssign}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-secundario text-white disabled:opacity-60"
                >
                    {savingAssign ? "Asignando..." : "Asignar"}
                </button>
                </div>
            </div>
            </div>
        )}
        {/* MÉTRICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Por cotizar</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{counts.c12}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600 h-fit">
                <Clock size={20} />
            </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">En revisión</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{counts.c14}</p>
            </div>
            <div className="p-2 bg-[#8B1D35]/10 rounded-lg text-[#8B1D35] h-fit">
                <FileText size={20} />
            </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">En proceso</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{counts.c13}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 h-fit">
                <ShoppingCart size={20} />
            </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 ring-1 ring-red-50 flex justify-between">
            <div>
                <p className="text-[10px] font-bold text-red-400 uppercase">Prioridad alta</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{counts.high}</p>
                <p className="text-[10px] text-gray-400 mt-1">+7 días sin resolver</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600 h-fit">
                <AlertTriangle size={20} />
            </div>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex justify-between">
            <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{counts.total}</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg text-gray-500 h-fit">
                <FileText size={20} />
            </div>
            </div>
        </div>

        {/* TABS + BUSCADOR */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
            <button
                onClick={() => { setTab("all"); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "all" ? "bg-[#8B1D35] text-white border-[#8B1D35]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                Todas ({counts.total})
            </button>

            <button
                onClick={() => { setTab("12"); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "12" ? "bg-orange-600 text-white border-orange-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                Por cotizar ({counts.c12})
            </button>

            <button
                onClick={() => { setTab("14"); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "14" ? "bg-[#8B1D35] text-white border-[#8B1D35]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                En revisión ({counts.c14})
            </button>

            <button
                onClick={() => { setTab("13"); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "13" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                En proceso ({counts.c13})
            </button>
            </div>

            <div className="relative md:ml-auto w-full md:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                value={q}
                onChange={(e) => {
                    setQ(e.target.value);
                    setCurrentPage(1);
                }}
                placeholder="Buscar por #, nombre, unidad, estatus..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
            />
            </div>
            <button
                onClick={() => fetchRequisitions({ silent: true })}
                disabled={loading || refreshing}
                className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                    loading || refreshing
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-[#8B1D35] border-[#8B1D35]/30 hover:bg-[#8B1D35]/10"
                }`}
            >
                <RotateCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Actualizando..." : "Actualizar"}
            </button>
        </div>
        <div className="mb-4 flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex flex-wrap gap-2">
                {isAdmin && (
                    <button
                        onClick={() => setOnlyUnassigned((v) => !v)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                            onlyUnassigned
                                ? "bg-secundario text-white border-secundario"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                        Solo sin asignar
                    </button>
                )}
                <button
                    onClick={() => setOnlyHighPriority((v) => !v)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                        onlyHighPriority
                            ? "bg-gray-800 text-white border-gray-800"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                >
                    +7 días
                </button>
            </div>
            <div className="md:ml-auto flex items-center gap-2">
                <label className="text-[11px] font-semibold text-gray-500">Ordenar:</label>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguas</option>
                    <option value="name">Nombre A-Z</option>
                    <option value="unit">Unidad A-Z</option>
                </select>
                <label className="text-[11px] font-semibold text-gray-500">Por página:</label>
                <select
                    value={itemsPerPage}
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                </select>
            </div>
        </div>
        <div className="mb-4 text-[11px] text-gray-500 font-medium">
            Última actualización:{" "}
            {lastUpdatedAt
                ? lastUpdatedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "—"}
        </div>

        {/* LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* LISTA */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-[#8B1D35]" />
                Requisiciones
                </h3>
                <span className="text-xs text-gray-400 font-semibold">
                Mostrando: {filtered.length}
                </span>
            </div>

            <div className="p-3 space-y-2 bg-gradient-to-b from-white to-gray-50/60">
                {loading ? (
                <div className="p-10 text-center text-gray-400">Cargando datos...</div>
                ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No hay requisiciones para este filtro.</div>
                ) : (
                filtered.map((req) => {
                    const b = badge(req.statuses_id);
                    return (
                    <div
                        key={req.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedReq(req)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setSelectedReq(req);
                        }}
                        className="w-full text-left px-4 sm:px-5 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all cursor-pointer shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-xs">#{req.id}</span>
                            <span className="font-bold text-gray-900 truncate">{req.request_name}</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10">
                                <Briefcase size={10} />
                                <span className="truncate max-w-[260px]">{req.nombre_unidad || "Sin Unidad"}</span>
                            </span>

                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                {req.coordinacion || "General"}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                                <User size={12} />
                                {req.solicitante || "Sin solicitante"}
                            </span>
                            <span className={`text-[11px] font-semibold ${getAgeDays(req.sent_on, req.created_at) >= 7 ? "text-red-600" : "text-sky-700"}`}>
                                En Compras: {ageLabel(getAgeDays(req.sent_on, req.created_at))}
                            </span>
                            </div>
                        </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${b.cls}`}>
                {b.text}
                </span>
                {req.assigned_operator_name ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secundario/10 text-secundario border border-secundario/20">
                    Asignado: {req.assigned_operator_name}
                </span>
                ) : isAdmin ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                    Sin asignar
                </span>
                ) : null}
                <span className="text-[10px] text-gray-400 font-medium">
                {new Date(req.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
            </div>
            </div>
            {isAdmin && Number(req.statuses_id) === 12 && (
                <div className="mt-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setAssigningReq(req);
                        setAssignOperatorId(req.assigned_operator_id ? String(req.assigned_operator_id) : "");
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold rounded bg-secundario/10 text-secundario border border-secundario/30 hover:bg-secundario/20"
                >
                    Asignar
                </button>
                </div>
            )}
            </div>
            );
        })
        )}
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                Página <b>{currentPage}</b> de <b>{Math.max(1, Math.ceil(total / itemsPerPage))}</b>
                </span>
                <div className="flex gap-2">
                <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
                >
                    ← Anterior
                </button>
                <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.max(1, Math.ceil(total / itemsPerPage)), p + 1))}
                    disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))}
                    className="px-3 py-1.5 rounded border border-gray-200 bg-white disabled:opacity-50"
                >
                    Siguiente →
                </button>
                </div>
            </div>
            </div>

            {/* SIDEBAR */}
            <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                <BarChart3 size={16} /> Top Áreas
                </h3>

                <div className="space-y-4">
                {topAreas.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin datos suficientes</p>
                ) : (
                    topAreas.map((area, index) => (
                    <div key={index}>
                        <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700">
                        <span className="truncate w-3/4">{area.name}</span>
                        <span>{area.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${index === 0 ? "bg-[#8B1D35]" : "bg-gray-400"}`}
                            style={{ width: `${(area.count / maxCount) * 100}%` }}
                        />
                        </div>
                    </div>
                    ))
                )}
                </div>
            </div>

            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex gap-3">
                <Lightbulb className="text-blue-600 flex-shrink-0" size={20} />
                <div>
                <h4 className="text-sm font-bold text-blue-800 mb-1">Tip de Compras:</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                    Usa los tabs (Por cotizar / En revisión / En proceso) para no perderte cuando haya 20+ requisiciones.
                </p>
                </div>
            </div>
            </div>
        </div>

        {selectedReq && (
            <RequisitionModal
            req={selectedReq}
            onClose={() => setSelectedReq(null)}
            onAssigned={async () => {
                await fetchRequisitions({ silent: true });
            }}
            onAction={async (type, payload) => {
                if (type !== "rechazar" && type !== "ajustar") return;

                const toastId = toast.loading("Procesando...");
                try {
                const res = await fetch(
                    `${API_ASSIGN}/${payload.id}/estatus`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                        body: JSON.stringify({
                            status_id: type === "ajustar" ? 7 : 10,
                            comentarios: type === "ajustar" ? `AJUSTE_COMPRAS: ${payload.motivo}` : payload.motivo,
                        }),
                    }
                );
                if (!res.ok) throw new Error();

                toast.success(type === "ajustar" ? "Edición solicitada" : "Cancelada", { id: toastId });
                await fetchRequisitions({ silent: true });
                setSelectedReq(null);
                } catch {
                toast.error(type === "ajustar" ? "Error al solicitar edición" : "Error al rechazar", { id: toastId });
                }
            }}
            />
        )}
        {refreshing && !loading && (
            <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                <AppLoader label="Actualizando..." />
            </div>
        )}
        </div>
    );
}
