import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, RefreshCw } from "lucide-react";
import RequisitionModal from "./RequisitionModal";
import ConfirmModal from "../../../components/ConfirmModal";
import { toast } from "sonner";

const API = "http://localhost:4000/api";

// ✅ util: forzar mínimo visible
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ✅ Loader (el que mandaste) — reutilizable
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

// Flujo igual al asistente (incluye borrador)
const STATUS_FLOW = [7, 8, 9, 12, 14, 13, 11, 10];
const STATUS_LABELS = {
    7: "Borrador",
    8: "Coordinación",
    9: "Secretaría",
    12: "Cotización",
    14: "Revisión",
    13: "Compra",
    11: "Finalizada",
    10: "Rechazada",
};

const renderStatusBadge = (statusId, statusName) => {
    let styles = "bg-gray-100 text-gray-700 border-gray-200";

    switch (Number(statusId)) {
        case 7:
            styles = "bg-gray-50 text-gray-600 border-gray-200";
        break;
        case 8:
            styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
        break;
            case 9:
            styles = "bg-blue-50 text-blue-700 border-blue-200";
        break;
            case 12:
            styles = "bg-orange-50 text-orange-700 border-orange-200";
        break;
            case 14:
            styles = "bg-gray-100 text-gray-700 border-gray-200";
        break;
            case 13:
            case 11:
            styles = "bg-secundario/10 text-secundario border-secundario/20";
        break;
            case 10:
            styles = "bg-red-50 text-red-700 border-red-200";
        break;
        default:
        break;
    }

    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold border ${styles} inline-flex items-center gap-1`}
        >
            <span className="w-2 h-2 rounded-full bg-current opacity-50" />
            {statusName || "Sin estatus"}
        </span>
    );
};

function safeDate(d) {
    if (!d) return "—";
    try {
        return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
    } catch {
        return "—";
    }
}

const ProgressBar = ({ statusId }) => {
    const index = STATUS_FLOW.indexOf(Number(statusId));
    if (index === -1) return null;

    const pct = ((index + 1) / STATUS_FLOW.length) * 100;

    return (
        <div className="mt-2">
            <div className="flex justify-between text-[11px] font-medium text-gray-500 gap-2">
                {STATUS_FLOW.map((id, i) => (
                <span key={id} className={i <= index ? "text-secundario font-semibold" : ""}>
                    {STATUS_LABELS[id]}
                </span>
                ))}
            </div>

            <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                <div className="h-2 bg-secundario rounded transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

export default function Recibidas() {
    const navigate = useNavigate();

    const [requisiciones, setRequisiciones] = useState([]);
    const [loading, setLoading] = useState(true);

    // ✅ para distinguir "cargando inicial" vs "actualizando"
    const [refreshing, setRefreshing] = useState(false);

    // ✅ Controles
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sort, setSort] = useState("new");

    // ✅ paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const POR_PAGINA = 6;

    // Modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const storageId = localStorage.getItem("users_id");

    // ✅ evita doble refresh
    const refreshingRef = useRef(false);

    const fetchRecibidas = async ({ showRefresh = false } = {}) => {
        if (!storageId) {
            navigate("/");
        return;
    }

    // ⏱️ mínimo visible (1–2s)
    const MIN_MS = 1500;
    const t0 = Date.now();

    try {
        if (showRefresh) {
            if (refreshingRef.current) return;
            refreshingRef.current = true;
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        const res = await fetch(`${API}/coordinador/${storageId}/recibidas`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Error al cargar recibidas");

        // ✅ fuerza el tiempo mínimo
        const elapsed = Date.now() - t0;
        if (elapsed < MIN_MS) await sleep(MIN_MS - elapsed);

        setRequisiciones(Array.isArray(data) ? data : []);
        setPaginaActual(1);
        } catch (err) {
        console.error(err);

        const elapsed = Date.now() - t0;
        if (elapsed < MIN_MS) await sleep(MIN_MS - elapsed);

        setRequisiciones([]);
        toast.error("No se pudo actualizar");
        } finally {
        if (showRefresh) {
            setRefreshing(false);
            refreshingRef.current = false;
        } else {
            setLoading(false);
        }
        }
    };

    useEffect(() => {
        fetchRecibidas({ showRefresh: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageId]);

    const filtered = useMemo(() => {
        let list = [...requisiciones];

        const qq = q.trim().toLowerCase();
        if (qq) {
        list = list.filter((r) => {
            const a = String(r.solicitante || "").toLowerCase();
            const b = String(r.request_name || "").toLowerCase();
            const c = String(r.ure_solicitante || "").toLowerCase();
            const d = String(r.id || "").toLowerCase();
            return a.includes(qq) || b.includes(qq) || c.includes(qq) || d.includes(qq);
        });
        }

        if (statusFilter !== "all") {
        const st = Number(statusFilter);
        list = list.filter((r) => Number(r.statuses_id) === st);
        }

        list.sort((a, b) => {
        const da = new Date(a.created_at).getTime() || 0;
        const db = new Date(b.created_at).getTime() || 0;
        return sort === "new" ? db - da : da - db;
        });

        return list;
    }, [requisiciones, q, statusFilter, sort]);

    const totalPaginas = useMemo(
        () => Math.max(1, Math.ceil(filtered.length / POR_PAGINA)),
        [filtered.length]
    );

    const inicio = (paginaActual - 1) * POR_PAGINA;
    const fin = inicio + POR_PAGINA;
    const page = filtered.slice(inicio, fin);

    useEffect(() => {
        setPaginaActual(1);
    }, [q, statusFilter, sort]);

    const handleRowClick = async (req) => {
        setSelectedReq(req);
        setItems([]);
        setLoadingItems(true);

        try {
        const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/items`);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "Error cargando partidas");
        setItems(Array.isArray(data) ? data : []);
        } catch (error) {
        console.error("Error cargando items:", error);
        setItems([]);
        toast.error("No se pudo cargar el detalle");
        } finally {
        setLoadingItems(false);
        }
    };

    const handleApprove = (req) => {
        setConfirmConfig({
        type: "approve",
        req,
        title: `Autorizar Folio #${req.id}`,
        highlight: `Folio #${req.id}`,
        description: "La solicitud pasará a Secretaría para su revisión.",
        confirmText: "Sí, autorizar",
        headerText: "Autorizar Requisición",
        variant: "success",
        });
        setConfirmOpen(true);
    };

    const handleReject = async (req, reason) => {
        try {
        const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/estatus`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status_id: 10, comentarios: reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "No se pudo rechazar");

        toast.success("Rechazada");
        setRequisiciones((prev) => prev.filter((r) => r.id !== req.id));
        setSelectedReq(null);
        } catch (e) {
        toast.error("Ocurrió un error al rechazar");
        }
    };

    const handleEditDraft = (req) => {
        navigate(`/coordinador/requisiciones/editar/${req.id}`);
    };

    const handleSendDraft = (req) => {
        setConfirmConfig({
        type: "send",
        req,
        title: `Enviar Folio #${req.id}`,
        highlight: `Folio #${req.id}`,
        description: "Se enviará a Secretaría y ya no podrás editar el borrador.",
        confirmText: "Sí, enviar",
        headerText: "Enviar a Secretaría",
        variant: "warning",
        });
        setConfirmOpen(true);
    };

    const handleConfirm = async () => {
        if (!confirmConfig?.req) return;
        const req = confirmConfig.req;

        if (confirmConfig.type === "approve") {
        try {
            const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/estatus`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status_id: 9, comentarios: "Autorizado por Coordinación" }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "No se pudo autorizar");

            toast.success("Autorizado");
            setRequisiciones((prev) => prev.filter((r) => r.id !== req.id));
            setSelectedReq(null);
        } catch (e) {
            toast.error("No se pudo autorizar");
        } finally {
            setConfirmOpen(false);
            setConfirmConfig(null);
        }
        return;
        }

        if (confirmConfig.type === "send") {
        try {
            const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/enviar`, {
            method: "PATCH",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || "No se pudo enviar");

            toast.success("Enviado");
            setRequisiciones((prev) =>
            prev.map((r) =>
                Number(r.id) === Number(req.id)
                ? { ...r, statuses_id: 9, nombre_estatus: "En secretaría" }
                : r
            )
            );
            setSelectedReq(null);
        } catch (e) {
            toast.error("No se pudo enviar");
        } finally {
            setConfirmOpen(false);
            setConfirmConfig(null);
        }
        }
    };

    return (
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg border border-gray-200 relative">
            <RequisitionModal
                req={selectedReq}
                items={items}
                loadingItems={loadingItems}
                onClose={() => setSelectedReq(null)}
                onApprove={handleApprove}
                onReject={handleReject}
                onEditDraft={handleEditDraft}
                onSendDraft={handleSendDraft}
            />
            <ConfirmModal
                open={confirmOpen}
                title={confirmConfig?.title}
                headerText={confirmConfig?.headerText}
                description={confirmConfig?.description}
                confirmText={confirmConfig?.confirmText}
                highlight={confirmConfig?.highlight}
                variant={confirmConfig?.variant}
                cancelText="Cancelar"
                onConfirm={handleConfirm}
                onCancel={() => {
                setConfirmOpen(false);
                setConfirmConfig(null);
                }}
            />

            {/* ✅ Overlay loader SOLO cuando refrescas (sin destruir el layout) */}
            {refreshing && (
                <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                <AppLoader label="Actualizando..." />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-secundario">
                        Requisiciones
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Revisa, edita borradores, autoriza o rechaza solicitudes.
                    </p>
                </div>

                <button
                    onClick={() => fetchRecibidas({ showRefresh: true })}
                    disabled={refreshing || loading}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2
                        ${(refreshing || loading)
                        ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                        : "bg-secundario text-white hover:opacity-90"}
                    `}
                >
                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Actualizando..." : "Actualizar"}
                </button>
            </div>

            {/* Buscador + filtros */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-4">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar (folio, solicitante, URE, asunto)..."
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-secundario/20"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm bg-white"
                >
                    <option value="all">Todos</option>
                    <option value="7">Borrador</option>
                    <option value="8">Coordinación</option>
                    <option value="9">Secretaría</option>
                    <option value="12">Cotización</option>
                    <option value="14">Revisión</option>
                    <option value="13">Compra</option>
                    <option value="11">Finalizada</option>
                    <option value="10">Rechazada</option>
                </select>

                <button
                    onClick={() => setSort((p) => (p === "new" ? "old" : "new"))}
                    className="px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
                    title="Cambiar orden"
                >
                    <ArrowUpDown size={16} className="text-gray-500" />
                    {sort === "new" ? "Más recientes" : "Más antiguas"}
                </button>
            </div>

            {/* Tabla */}
            <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
                    <div className="col-span-7">Solicitud</div>
                    <div className="col-span-3">Estatus</div>
                    <div className="col-span-2 text-right">Fecha</div>
                </div>

                {loading ? (
                <AppLoader label="Cargando..." />
                ) : page.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No hay requisiciones.</div>
                ) : (
                <div className="divide-y">
                    {page.map((req) => {
                    const st = Number(req.statuses_id);

                    return (
                        <button
                            key={req.id}
                            type="button"
                            onClick={() => handleRowClick(req)}
                            className="w-full text-left px-4 py-4 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-secundario/20"
                        >
                            <div className="grid grid-cols-12 gap-3 items-start">
                                <div className="col-span-7 min-w-0">
                                    <div className="font-bold text-secundario truncate text-[15px]">
                                        {req.request_name || "Sin asunto"}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-1">
                                        Folio: <b>#{req.id}</b> • <b>{req.solicitante}</b>
                                        {req.ure_solicitante ? ` • ${req.ure_solicitante}` : ""}
                                    </div>

                                    <div className="mt-2">
                                        <ProgressBar statusId={st} />
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <div className="text-sm text-gray-800">
                                        Estatus: <b>{req.nombre_estatus || req.estatus || "—"}</b>
                                    </div>
                                    <div className="mt-2">
                                        {renderStatusBadge(st, req.nombre_estatus || req.estatus)}
                                    </div>
                                </div>

                                <div className="col-span-2 text-right text-sm text-gray-700">
                                    {safeDate(req.created_at)}
                                </div>
                            </div>
                        </button>
                    );
                    })}
                </div>
                )}
            </div>

            {/* Paginación */}
            <div className="mt-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                    <button
                        onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                        disabled={paginaActual === 1}
                        className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Anterior
                    </button>

                    <span className="text-sm text-gray-600 text-center">
                        Página <b>{paginaActual}</b> de <b>{totalPaginas}</b>
                    </span>

                    <button
                        onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                        disabled={paginaActual === totalPaginas}
                        className="px-4 py-2 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Siguiente →
                    </button>
                </div>
            </div>
        </div>
    );
}
