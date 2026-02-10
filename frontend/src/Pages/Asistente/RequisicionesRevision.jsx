import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Clock } from "lucide-react";
import { toast } from "sonner";

const API_URL = "http://localhost:4000/api/asistente";

export default function RequisicionesRevision() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requisitions, setRequisitions] = useState([]);
    const [q, setQ] = useState("");

    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const userId = user?.id || user?.users_id || user?.user_id;

    const fetchData = async () => {
        try {
        setLoading(true);

        if (!userId) {
            toast.error("No se detectó usuario logueado");
            setRequisitions([]);
            return;
        }

        const resp = await fetch(`${API_URL}/revision?user_id=${encodeURIComponent(userId)}`);
        const data = await resp.json().catch(() => []);
        if (!resp.ok) throw new Error(data?.message || "Error cargando requisiciones");

        setRequisitions(Array.isArray(data) ? data : []);
        } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar revisión");
        setRequisitions([]);
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return requisitions;
        return requisitions.filter((r) => {
        return (
            String(r.id).includes(s) ||
            (r.request_name || "").toLowerCase().includes(s) ||
            (r.nombre_unidad || "").toLowerCase().includes(s) ||
            (r.nombre_estatus || "").toLowerCase().includes(s)
        );
        });
    }, [q, requisitions]);

    return (
        <div className="p-6 min-h-[calc(100vh-24px)] bg-[#F3F4F6]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
            <h2 className="text-lg font-bold text-gray-800">En revisión</h2>
            <p className="text-xs text-gray-500">
                Aquí aparecen las requisiciones cuando Compras cierra la recepción de cotizaciones.
            </p>
            </div>

            <div className="relative md:w-96 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por #, nombre, unidad, estatus..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none bg-white"
            />
            </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText size={16} className="text-[#8B1D35]" />
            <h3 className="font-bold text-gray-800 text-sm">Requisiciones</h3>
            <span className="ml-auto text-xs text-gray-400">
                {loading ? "Cargando..." : `${filtered.length} registro(s)`}
            </span>
            </div>

            <div className="divide-y divide-gray-50">
            {loading ? (
                <div className="p-10 text-center text-gray-400 text-sm">Cargando...</div>
            ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                No tienes requisiciones en revisión.
                </div>
            ) : (
                filtered.map((r) => (
                <button
                    key={r.id}
                    onClick={() => navigate(`/unidad/revision/${r.id}`)}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="font-bold text-gray-800">
                        #{r.id} <span className="font-semibold">{r.request_name || "Sin título"}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                        {r.nombre_unidad || "Sin unidad"} {r.coordinacion ? `· ${r.coordinacion}` : ""}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("es-MX") : "—"}
                        </div>
                    </div>

                    <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/10">
                        EN REVISIÓN
                    </span>
                    </div>
                </button>
                ))
            )}
            </div>
        </div>
        </div>
    );
}
