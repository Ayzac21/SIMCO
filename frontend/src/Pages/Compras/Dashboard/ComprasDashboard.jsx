import React, { useEffect, useMemo, useState } from "react";
import { Search, Clock, AlertTriangle, ShoppingCart, FileText, BarChart3, Lightbulb, Briefcase, User } from "lucide-react";
import { toast } from "sonner";
import RequisitionModal from "../requisiciones/RequisitionModal";

const API = "http://localhost:4000/api/compras/dashboard";

export default function ComprasDashboard() {
    const [requisitions, setRequisitions] = useState([]);
    const [selectedReq, setSelectedReq] = useState(null);
    const [loading, setLoading] = useState(true);

    const [tab, setTab] = useState("all"); // all | 12 | 14 | 13
    const [q, setQ] = useState("");

    const fetchRequisitions = async () => {
        try {
        setLoading(true);
        const response = await fetch(API);
        if (!response.ok) throw new Error("Error al cargar datos");
        const data = await response.json();
        setRequisitions(Array.isArray(data) ? data : []);
        } catch (error) {
        console.error(error);
        toast.error("Error al conectar con el servidor");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequisitions();
    }, []);

    const counts = useMemo(() => {
        const c12 = requisitions.filter((r) => Number(r.statuses_id) === 12).length;
        const c14 = requisitions.filter((r) => Number(r.statuses_id) === 14).length;
        const c13 = requisitions.filter((r) => Number(r.statuses_id) === 13).length;

        // prioridad alta: ejemplo = >7 días sin resolver (ajústalo si quieres)
        const now = Date.now();
        const high = requisitions.filter((r) => {
        const days = Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return days >= 7 && (Number(r.statuses_id) === 12 || Number(r.statuses_id) === 14);
        }).length;

        return { c12, c14, c13, total: requisitions.length, high };
    }, [requisitions]);

    const filtered = useMemo(() => {
        let list = requisitions;

        if (tab !== "all") {
        const st = Number(tab);
        list = list.filter((r) => Number(r.statuses_id) === st);
        }

        const query = q.trim().toLowerCase();
        if (query) {
        list = list.filter((r) => {
            return (
            String(r.id).includes(query) ||
            (r.request_name || "").toLowerCase().includes(query) ||
            (r.nombre_unidad || "").toLowerCase().includes(query) ||
            (r.nombre_estatus || "").toLowerCase().includes(query) ||
            (r.solicitante || "").toLowerCase().includes(query)
            );
        });
        }

        return list;
    }, [requisitions, tab, q]);

    const topAreas = useMemo(() => {
        const counts = {};
        requisitions.forEach((req) => {
        const area = req.nombre_unidad || "Sin Unidad";
        counts[area] = (counts[area] || 0) + 1;
        });

        return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
    }, [requisitions]);

    const maxCount = topAreas.length > 0 ? topAreas[0].count : 1;

    const badge = (st) => {
        if (Number(st) === 12) return { text: "POR COTIZAR", cls: "bg-orange-50 text-orange-600 border-orange-100" };
        if (Number(st) === 14) return { text: "EN REVISIÓN", cls: "bg-[#8B1D35]/10 text-[#8B1D35] border-[#8B1D35]/10" };
        if (Number(st) === 13) return { text: "EN PROCESO", cls: "bg-blue-50 text-blue-600 border-blue-100" };
        return { text: "OTRO", cls: "bg-gray-100 text-gray-600 border-gray-200" };
    };

    return (
        <div className="p-6 min-h-screen bg-[#F3F4F6]">
        {/* MÉTRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                onClick={() => setTab("all")}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "all" ? "bg-[#8B1D35] text-white border-[#8B1D35]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                Todas ({counts.total})
            </button>

            <button
                onClick={() => setTab("12")}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "12" ? "bg-orange-600 text-white border-orange-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                Por cotizar ({counts.c12})
            </button>

            <button
                onClick={() => setTab("14")}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                tab === "14" ? "bg-[#8B1D35] text-white border-[#8B1D35]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
            >
                En revisión ({counts.c14})
            </button>

            <button
                onClick={() => setTab("13")}
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
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por #, nombre, unidad, estatus..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
            />
            </div>
        </div>

        {/* LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LISTA */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-[#8B1D35]" />
                Requisiciones
                </h3>
                <span className="text-xs text-gray-400 font-semibold">
                Mostrando: {filtered.length}
                </span>
            </div>

            <div className="divide-y divide-gray-50">
                {loading ? (
                <div className="p-10 text-center text-gray-400">Cargando datos...</div>
                ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No hay requisiciones para este filtro.</div>
                ) : (
                filtered.map((req) => {
                    const b = badge(req.statuses_id);
                    return (
                    <button
                        key={req.id}
                        onClick={() => setSelectedReq(req)}
                        className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-700">#{req.id}</span>
                            <span className="font-bold text-gray-900 truncate">{req.request_name}</span>
                            </div>

                            <div className="mt-2 flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10 w-fit">
                                <Briefcase size={10} />
                                <span className="truncate max-w-[380px]">{req.nombre_unidad || "Sin Unidad"}</span>
                            </span>

                            <span className="text-[10px] text-gray-500 font-semibold">
                                ↳ {req.coordinacion || "General"}
                            </span>

                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <User size={12} />
                                {req.solicitante || "Sin solicitante"}
                            </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${b.cls}`}>
                            {b.text}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(req.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                        </div>
                        </div>
                    </button>
                    );
                })
                )}
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
            onAction={() => {
                toast.success("Operación exitosa");
                fetchRequisitions();
                setSelectedReq(null);
            }}
            />
        )}
        </div>
    );
}
