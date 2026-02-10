import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Send,
    Users,
    CheckCircle2,
    Search,
    Save,
    X,
} from "lucide-react";
import { toast } from "sonner";
import CotizacionClosedNotice from "./CotizacionClosedNotice";
import ConfirmModal from "../../../components/ConfirmModal";

const API_URL = "http://localhost:4000/api/compras";

const getAuthHeaders = () => {
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    return {
        "x-user-id": String(user?.id || ""),
        "x-user-role": String(user?.role || ""),
    };
};

function ProviderRow({ p, selectedProviderIds, toggleSelected, disabled = false }) {
    return (
        <label
        className={`flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl ${
            disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
        }`}
        >
        <div className="flex items-center gap-3">
            <input
            type="checkbox"
            disabled={disabled}
            checked={selectedProviderIds.has(p.id)}
            onChange={() => toggleSelected(p.id)}
            />
            <div>
            <div className="font-semibold text-sm text-gray-800">{p.name}</div>
            <div className="text-xs text-gray-500">{p.email || "Sin email"}</div>
            </div>
        </div>
        <div className="text-xs text-gray-400">{p.rfc || ""}</div>
        </label>
    );
    }

    export default function GestionCotizacion() {
    const { id } = useParams(); // requisition_id
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [closing, setClosing] = useState(false);
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
    const [confirmSendOpen, setConfirmSendOpen] = useState(false);
    const [sendingReview, setSendingReview] = useState(false);
    const [reopening, setReopening] = useState(false);

    const [requisition, setRequisition] = useState(null);
    const [items, setItems] = useState([]);

    const [providersSuggested, setProvidersSuggested] = useState([]);
    const [invitedProviders, setInvitedProviders] = useState([]);

    const [invitationSent, setInvitationSent] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [showOnlyResponded, setShowOnlyResponded] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProviderIds, setSelectedProviderIds] = useState(new Set());

    const [providerTab, setProviderTab] = useState("suggested"); // suggested | all
    const [providerSearch, setProviderSearch] = useState("");
    const [loadingAllProviders, setLoadingAllProviders] = useState(false);
    const [allProviders, setAllProviders] = useState([]);

    const [prices, setPrices] = useState({});
    const [descriptions, setDescriptions] = useState({});

    const statusLabel = (s) => {
        if (!s) return "";
        if (s === "responded") return "respondió";
        if (s === "invited") return "invitado";
        if (s === "expired") return "sin respuesta";
        if (s === "declined") return "rechazó";
        return s;
    };

    // ✅ Cerrada real usando requisition (cuando ya pasó a revisión o tiene closed_at)
    const isClosed = useMemo(() => {
        const st = Number(requisition?.statuses_id);
        const closedAt = requisition?.quotation_closed_at;
        return Boolean(closedAt || st === 14 || st === 13);
    }, [requisition, invitedProviders]);

    const fetchAllProviders = async (q = "") => {
        try {
        setLoadingAllProviders(true);
        const resp = await fetch(`${API_URL}/providers?q=${encodeURIComponent(q)}`, {
            headers: getAuthHeaders(),
        });
        if (!resp.ok) throw new Error("Error cargando proveedores");
        const data = await resp.json();
        setAllProviders(Array.isArray(data) ? data : []);
        } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar todos los proveedores");
        } finally {
        setLoadingAllProviders(false);
        }
    };

    const loadData = async () => {
        try {
        setLoading(true);

        const response = await fetch(`${API_URL}/cotizacion/${id}/data`, {
            headers: getAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.message || "Error al cargar la cotización";
            throw new Error(msg);
        }

        setRequisition(data.requisition);
        setItems(Array.isArray(data.items) ? data.items : []);

        setProvidersSuggested(Array.isArray(data.providers) ? data.providers : []);
        setInvitedProviders(Array.isArray(data.invitedProviders) ? data.invitedProviders : []);

        const pricesMap = {};
        const descMap = {};
        (data.savedPrices || []).forEach((p) => {
            const key = `${p.line_item_id}_${p.provider_id}`;
            pricesMap[key] = p.unit_price == null ? "" : String(p.unit_price);
            descMap[key] = p.offered_description ?? "";
        });

        setPrices(pricesMap);
        setDescriptions(descMap);

        if ((data.invitedProviders || []).length > 0) setInvitationSent(true);
        setShowOnlyResponded(false);

        setLoading(false);
        } catch (error) {
        console.error(error);
        toast.error(error?.message || "Error al cargar datos del servidor");
        setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handlePriceChange = (itemId, providerId, val) => {
        setPrices((prev) => ({ ...prev, [`${itemId}_${providerId}`]: val }));
    };

    const handleDescChange = (itemId, providerId, val) => {
        setDescriptions((prev) => ({ ...prev, [`${itemId}_${providerId}`]: val }));
    };

    const calculateProviderTotal = (providerId) => {
        let total = 0;
        items.forEach((item) => {
        const price = parseFloat(prices[`${item.id}_${providerId}`]) || 0;
        total += price * item.quantity;
        });
        return total;
    };

    const providerHasAnyPriceOrDesc = (providerId) => {
        return items.some((item) => {
        const k = `${item.id}_${providerId}`;
        const price = parseFloat(prices[k]);
        const hasPrice = Number.isFinite(price) && price > 0;
        const hasDesc = (descriptions[k] || "").trim().length > 0;
        return hasPrice || hasDesc;
        });
    };

    const visibleProviders = useMemo(() => {
        let list = invitedProviders;

        if (showOnlyResponded) {
        list = list.filter((p) => p.status === "responded" || providerHasAnyPriceOrDesc(p.id));
        }

        const q = tableSearch.toLowerCase();
        if (q) list = list.filter((p) => (p.name || "").toLowerCase().includes(q));

        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invitedProviders, tableSearch, showOnlyResponded, prices, descriptions, items]);

    const openModal = () => {
        if (isClosed) {
        toast.warning("Recepción finalizada");
        return;
        }

        const current = new Set(invitedProviders.map((p) => p.id));
        setSelectedProviderIds(current);

        const hasSuggested = providersSuggested.length > 0;
        setProviderTab(hasSuggested ? "suggested" : "all");
        setProviderSearch("");

        setIsModalOpen(true);

        if (!hasSuggested) fetchAllProviders("");
    };

    const toggleSelected = (providerId) => {
        setSelectedProviderIds((prev) => {
        const next = new Set(prev);
        if (next.has(providerId)) next.delete(providerId);
        else next.add(providerId);
        return next;
        });
    };

    const handleInviteSelected = async () => {
        if (isClosed) {
        toast.warning("Recepción finalizada");
        return;
        }

        const provider_ids = Array.from(selectedProviderIds);
        if (provider_ids.length === 0) {
        toast.warning("Selecciona al menos un proveedor");
        return;
        }

        try {
        setInviting(true);

        const response = await fetch(`${API_URL}/cotizacion/${id}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ provider_ids, deadline_at: null }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al invitar");

        toast.success("Proveedores invitados");

        setIsModalOpen(false);
        setInvitationSent(true);

        await loadData();
        } catch (e) {
        console.error(e);
        toast.error("No se pudo invitar a los proveedores");
        } finally {
        setInviting(false);
        }
    };

    const handleSaveChanges = async () => {
        if (isClosed) {
        toast.error("Recepción finalizada. Reabre la recepción para poder guardar.");
        return;
        }
        if (saving) return;

        const payload = [];
        const keys = new Set([...Object.keys(prices), ...Object.keys(descriptions)]);

        keys.forEach((key) => {
        const [itemId, providerId] = key.split("_");

        const unit_price = parseFloat(prices[key]);
        const offered_description = (descriptions[key] ?? "").toString();

        const hasPrice = Number.isFinite(unit_price) && unit_price >= 0;
        const hasDesc = offered_description.trim().length > 0;

        if (!hasPrice && !hasDesc) return;

        payload.push({
            line_item_id: parseInt(itemId, 10),
            provider_id: parseInt(providerId, 10),
            unit_price: Number.isFinite(unit_price) ? unit_price : 0,
            offered_description,
            notes: "",
            is_winner: 0,
        });
        });

        if (payload.length === 0) {
        toast.warning("No hay datos para guardar");
        return;
        }

        try {
        setSaving(true);

        const response = await fetch(`${API_URL}/cotizacion/${id}/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ prices: payload }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al guardar");

        toast.success("Cotización guardada");

        await loadData();
        } catch (error) {
        console.error(error);
        toast.error("Error al guardar");
        } finally {
        setSaving(false);
        }
    };

    const handleCloseInvites = () => {
        if (closing) return;
        setConfirmCloseOpen(true);
    };

    const confirmCloseInvites = async () => {
        if (closing) return;
        setConfirmCloseOpen(false);
        const toastId = toast.loading("Procesando...");

        try {
        setClosing(true);

        const response = await fetch(`${API_URL}/cotizacion/${id}/close`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al cerrar");

        toast.success(data?.message || "Recepción cerrada", { id: toastId });
        await loadData();
        } catch (e) {
        console.error(e);
        toast.error(e?.message || "No se pudo cerrar la recepción", { id: toastId });
        } finally {
        setClosing(false);
        }
    };

    const confirmSendToReview = async () => {
        if (sendingReview) return;
        setConfirmSendOpen(false);
        const toastId = toast.loading("Enviando a revisión...");
        try {
        setSendingReview(true);
        const response = await fetch(`${API_URL}/cotizacion/${id}/send-review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al enviar a revisión");

        toast.success(data?.message || "Enviado a revisión", { id: toastId });
        setTimeout(() => {
            navigate("/compras/dashboard");
        }, 600);
        } catch (e) {
        console.error(e);
        toast.error(e?.message || "No se pudo enviar a revisión", { id: toastId });
        } finally {
        setSendingReview(false);
        }
    };

    const handleReopenReception = async () => {
        if (reopening) return;
        const toastId = toast.loading("Reabriendo recepción...");
        try {
        setReopening(true);
        const response = await fetch(`${API_URL}/cotizacion/${id}/reopen`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al reabrir");
        toast.success(data?.message || "Recepción reabierta", { id: toastId });
        await loadData();
        } catch (e) {
        console.error(e);
        toast.error(e?.message || "No se pudo reabrir la recepción", { id: toastId });
        } finally {
        setReopening(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center text-sm text-gray-500">Cargando gestión...</div>;
    }

    const modalList = providerTab === "suggested" ? providersSuggested : allProviders;

    return (
        <div className="p-6 bg-[#F3F4F6] min-h-[calc(100vh-24px)] font-sans">
        <ConfirmModal
            open={confirmCloseOpen}
            title="Cerrar recepción de cotización"
            headerText="Confirmar cierre"
            description="Se marcarán como 'Sin respuesta' los proveedores que sigan en 'Invitado'. Después podrás enviar a revisión."
            confirmText="Sí, cerrar recepción"
            cancelText="Cancelar"
            onConfirm={confirmCloseInvites}
            onCancel={() => setConfirmCloseOpen(false)}
        />
        <ConfirmModal
            open={confirmSendOpen}
            title="Enviar a revisión"
            headerText="Confirmar envío"
            description="La requisición pasará a 'En revisión' para que el solicitante seleccione proveedores. Compras ya no podrá editar."
            confirmText="Sí, enviar"
            cancelText="Cancelar"
            onConfirm={confirmSendToReview}
            onCancel={() => setConfirmSendOpen(false)}
        />
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
            <button
                onClick={() => navigate(-1)}
                className="p-2 bg-white text-gray-600 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50"
            >
                <ArrowLeft size={18} />
            </button>

            <div>
                <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">Cotización #{id}</h1>
                {isClosed && (
                    <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded-full bg-gray-200 text-gray-700 uppercase">
                    Recepción finalizada
                    </span>
                )}
                </div>

                <p className="text-xs text-gray-500 flex items-center gap-1">
                Categoría:{" "}
                <span className="font-semibold text-[#8B1D35] bg-[#8B1D35]/10 px-1.5 rounded">
                    {requisition?.category_name}
                </span>
                </p>
            </div>
            </div>

            {invitationSent && (
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                    type="checkbox"
                    checked={showOnlyResponded}
                    onChange={(e) => setShowOnlyResponded(e.target.checked)}
                    />
                    Solo respondieron
                </label>
                </div>

                <div className="relative flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Filtrar proveedor..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-[#8B1D35] outline-none shadow-sm"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                />
                </div>

                <button
                onClick={handleSaveChanges}
                disabled={saving || isClosed}
                className={`bg-[#8B1D35] hover:bg-[#72182b] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors ${
                    saving || isClosed ? "opacity-60 cursor-not-allowed hover:bg-[#8B1D35]" : ""
                }`}
                title={isClosed ? "Recepción finalizada: no editable" : "Guardar cambios"}
                >
                <Save size={14} />
                {saving ? "GUARDANDO..." : "GUARDAR"}
                </button>
            </div>
            )}
        </div>

        {/* ✅ MENSAJE CLARO CUANDO ESTÁ CERRADA */}
        {invitationSent && isClosed && <CotizacionClosedNotice requisition={requisition} />}

        {/* VISTA 1 */}
        {!invitationSent && (
            <div className="flex flex-col items-center justify-start pt-10">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden max-w-lg w-full">
                <div className="h-1.5 w-full bg-[#8B1D35]" />
                <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-[#8B1D35]/10 rounded-full shrink-0">
                    <Users size={24} className="text-[#8B1D35]" />
                    </div>
                    <div>
                    <h2 className="text-lg font-bold text-gray-800">Proveedores sugeridos</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        Se detectaron{" "}
                        <span className="font-bold text-gray-800">{providersSuggested.length}</span>{" "}
                        proveedores en la categoría{" "}
                        <span className="italic">"{requisition?.category_name}"</span>.
                    </p>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                    onClick={openModal}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-600 font-bold rounded-lg text-xs hover:bg-gray-50"
                    >
                    VER LISTA
                    </button>

                    <button
                    onClick={openModal}
                    className="flex-[2] px-4 py-2 bg-[#8B1D35] text-white font-bold rounded-lg text-xs hover:bg-[#72182b] shadow-md flex items-center justify-center gap-2"
                    >
                    <Send size={14} /> INVITAR PROVEEDORES
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* VISTA 2 */}
        {invitationSent && (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-[#8B1D35]">
                <CheckCircle2 size={16} />
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide">
                    Cuadro Comparativo
                </h3>
                </div>

                <div className="flex items-center gap-3">
                {!isClosed && (
                    <button
                    onClick={handleCloseInvites}
                    disabled={closing}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 ${
                        closing ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    >
                    {closing ? "CERRANDO..." : "CERRAR RECEPCIÓN"}
                    </button>
                )}

                {Boolean(requisition?.quotation_closed_at) && Number(requisition?.statuses_id) === 12 && (
                    <button
                    onClick={handleReopenReception}
                    disabled={reopening}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 ${
                        reopening ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    >
                    {reopening ? "REABRIENDO..." : "REABRIR RECEPCIÓN"}
                    </button>
                )}

                {Boolean(requisition?.quotation_closed_at) && Number(requisition?.statuses_id) === 12 && (
                    <button
                    onClick={() => setConfirmSendOpen(true)}
                    disabled={sendingReview}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg bg-[#8B1D35] text-white shadow-sm hover:bg-[#72182b] ${
                        sendingReview ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    >
                    {sendingReview ? "ENVIANDO..." : "ENVIAR A REVISIÓN"}
                    </button>
                )}

                <button
                    onClick={openModal}
                    disabled={isClosed}
                    className={`text-xs font-bold ${
                    isClosed ? "text-gray-400 cursor-not-allowed" : "text-[#8B1D35] hover:underline"
                    }`}
                >
                    Gestionar invitados
                </button>
                </div>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-240px)]">
                <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                    <th className="sticky left-0 z-30 bg-gray-50 px-4 py-3 min-w-[260px] border-r border-gray-300 text-gray-700 font-bold">
                        Artículo ({items.length})
                    </th>

                    {visibleProviders.map((prov) => (
                        <th
                        key={prov.id}
                        className="px-2 py-3 min-w-[220px] border-r border-gray-200 text-center font-semibold text-gray-600 bg-gray-50"
                        title={prov.status ? `Status: ${statusLabel(prov.status)}` : prov.name}
                        >
                        <div className="truncate max-w-[200px] mx-auto">{prov.name}</div>
                        {prov.status && (
                            <div className="text-[10px] mt-1 text-gray-400 capitalize">
                            {statusLabel(prov.status)}
                            </div>
                        )}
                        </th>
                    ))}
                    </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 px-4 py-3 border-r border-gray-200">
                        <div className="font-bold text-gray-700 text-xs truncate">{item.description}</div>
                        <div className="text-[10px] text-gray-400">
                            Cant: {item.quantity} {item.unidad_medida ? `(${item.unidad_medida})` : ""}
                        </div>
                        </td>

                        {visibleProviders.map((prov) => {
                        const k = `${item.id}_${prov.id}`;
                        return (
                            <td key={prov.id} className="border-r border-gray-100 bg-white group-hover:bg-gray-50 relative align-top">
                            <div className="relative">
                                <div className="absolute left-2 top-3 text-gray-300 text-[10px] pointer-events-none">$</div>
                                <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                disabled={isClosed}
                                value={prices[k] ?? ""}
                                className={`w-full text-right text-xs py-2 pr-2 bg-transparent outline-none font-medium text-gray-700 pl-4 ${
                                    isClosed ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                                onChange={(e) => handlePriceChange(item.id, prov.id, e.target.value)}
                                />
                            </div>

                            <textarea
                                rows={2}
                                placeholder="Descripción / características..."
                                disabled={isClosed}
                                value={descriptions[k] ?? ""}
                                onChange={(e) => handleDescChange(item.id, prov.id, e.target.value)}
                                className={`w-full text-[10px] px-2 pb-2 pt-1 bg-transparent resize-none outline-none text-gray-600 ${
                                isClosed ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                            />
                            </td>
                        );
                        })}
                    </tr>
                    ))}

                    <tr className="bg-gray-100 font-bold text-xs border-t border-gray-300 sticky bottom-0 z-20">
                    <td className="sticky left-0 z-30 bg-gray-100 px-4 py-3 border-r border-gray-300 text-right uppercase text-gray-600">
                        Total Cotización:
                    </td>

                    {visibleProviders.map((prov) => {
                        const total = calculateProviderTotal(prov.id);
                        return (
                        <td
                            key={prov.id}
                            className={`px-2 py-3 text-right pr-2 border-r border-gray-200 ${
                            total > 0 ? "text-[#8B1D35]" : "text-gray-400"
                            }`}
                        >
                            {total > 0
                            ? `$${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </td>
                        );
                    })}
                    </tr>
                </tbody>
                </table>
            </div>
            </div>
        )}

        {/* MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => !inviting && setIsModalOpen(false)} />

            <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div>
                    <h3 className="font-bold text-gray-800">Seleccionar proveedores</h3>
                    <p className="text-xs text-gray-500">Sugeridos por categoría o busca en todos.</p>
                </div>

                <button onClick={() => !inviting && setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                    <X size={18} className="text-gray-500" />
                </button>
                </div>

                <div className="px-5 pt-4">
                <div className="flex items-center gap-2">
                    <button
                    onClick={() => setProviderTab("suggested")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        providerTab === "suggested"
                        ? "bg-[#8B1D35] text-white border-[#8B1D35]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                    >
                    Sugeridos ({providersSuggested.length})
                    </button>

                    <button
                    onClick={() => {
                        setProviderTab("all");
                        if (allProviders.length === 0) fetchAllProviders("");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        providerTab === "all"
                        ? "bg-[#8B1D35] text-white border-[#8B1D35]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                    >
                    Todos
                    </button>

                    {providerTab === "all" && (
                    <div className="ml-auto relative w-72">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchAllProviders(providerSearch)}
                        placeholder="Buscar por nombre, email o RFC..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                        disabled={isClosed}
                        />
                    </div>
                    )}
                </div>
                </div>

                <div className="p-4 max-h-[60vh] overflow-auto">
                {providerTab === "suggested" ? (
                    providersSuggested.length === 0 ? (
                    <div className="text-sm text-gray-500">No hay sugeridos. Usa <b>Todos</b>.</div>
                    ) : (
                    <div className="space-y-2">
                        {modalList.map((p) => (
                        <ProviderRow
                            key={p.id}
                            p={p}
                            selectedProviderIds={selectedProviderIds}
                            toggleSelected={toggleSelected}
                            disabled={inviting || isClosed}
                        />
                        ))}
                    </div>
                    )
                ) : loadingAllProviders ? (
                    <div className="text-sm text-gray-500">Cargando proveedores...</div>
                ) : (
                    <div className="space-y-2">
                    {modalList.map((p) => (
                        <ProviderRow
                        key={p.id}
                        p={p}
                        selectedProviderIds={selectedProviderIds}
                        toggleSelected={toggleSelected}
                        disabled={inviting || isClosed}
                        />
                    ))}
                    {modalList.length === 0 && (
                        <div className="text-sm text-gray-500">
                        No hay resultados. Escribe algo y presiona <b>Enter</b>.
                        </div>
                    )}
                    </div>
                )}
                </div>

                <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                    Seleccionados: <span className="font-bold">{selectedProviderIds.size}</span>
                </div>

                <div className="flex gap-2">
                    <button
                    onClick={() => setIsModalOpen(false)}
                    disabled={inviting}
                    className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                    Cancelar
                    </button>

                    <button
                    onClick={handleInviteSelected}
                    disabled={inviting || selectedProviderIds.size === 0 || isClosed}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-[#8B1D35] text-white hover:bg-[#72182b] disabled:opacity-60"
                    >
                    {inviting ? "INVITANDO..." : "INVITAR"}
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}
        </div>
    );
}
