import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    CheckCircle2,
    FileText,
    Search,
    Save,
    Users,
    X,
} from "lucide-react";
import { toast } from "sonner";
import CotizacionClosedNotice from "./CotizacionClosedNotice";
import ConfirmModal from "../../../components/ConfirmModal";
import { API_BASE_URL } from "../../../api/config";
import useEscapeKey from "../../../hooks/useEscapeKey";

const API_URL = `${API_BASE_URL}/compras`;
const ITEM_CHUNK_SIZE = 30;
const ITEM_SCROLL_THRESHOLD_PX = 280;

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

const parsePct = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
};

const parseTaxesFromNotes = (notes) => {
    if (!notes) return { vat: null, isr: null };
    try {
        const parsed = typeof notes === "string" ? JSON.parse(notes) : notes;
        return {
            vat: parsePct(parsed?.vat_percentage),
            isr: parsePct(parsed?.isr_percentage),
        };
    } catch {
        return { vat: null, isr: null };
    }
};

const sanitizePriceInput = (value) => {
    const cleaned = String(value || "")
        .replace(/[$\s,]/g, "")
        .replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join("")}`;
};

const normalizePriceInput = (value) => {
    const raw = sanitizePriceInput(value);
    if (raw === "") return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
};

const formatPriceInput = (value) => {
    const raw = sanitizePriceInput(value);
    if (raw === "") return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
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
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdmin = user?.role === "compras_admin";
    const isOperator = user?.role === "compras_operador";
    const canSendToReview = isAdmin || isOperator;
    const isReader = user?.role === "compras_lector";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [applyingProviders, setApplyingProviders] = useState(false);
    const [closing, setClosing] = useState(false);
    const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
    const [confirmSendOpen, setConfirmSendOpen] = useState(false);
    const [sendingReview, setSendingReview] = useState(false);
    const [reopening, setReopening] = useState(false);

    const [requisition, setRequisition] = useState(null);
    const [items, setItems] = useState([]);

    const [providersSuggested, setProvidersSuggested] = useState([]);
    const [invitedProviders, setInvitedProviders] = useState([]);

    const [tableSearch, setTableSearch] = useState("");
    const [showOnlyResponded, setShowOnlyResponded] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProviderIds, setSelectedProviderIds] = useState(new Set());

    const [providerTab, setProviderTab] = useState("suggested"); // suggested | all
    const [providerSearch, setProviderSearch] = useState("");
    const [loadingAllProviders, setLoadingAllProviders] = useState(false);
    const [allProviders, setAllProviders] = useState([]);
    useEscapeKey(isModalOpen, () => {
        if (!applyingProviders) setIsModalOpen(false);
    }, applyingProviders);

    const [prices, setPrices] = useState({});
    const [vatPercentages, setVatPercentages] = useState({});
    const [isrPercentages, setIsrPercentages] = useState({});
    const [editingPriceKey, setEditingPriceKey] = useState(null);
    const [selectedByItem, setSelectedByItem] = useState({});
    const [visibleItemCount, setVisibleItemCount] = useState(ITEM_CHUNK_SIZE);
    const tableScrollRef = useRef(null);
    const [itemImagePreviews, setItemImagePreviews] = useState({});
    const requestedItemImagesRef = useRef(new Set());

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
    }, [requisition]);

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
        const vatMap = {};
        const isrMap = {};
        (data.savedPrices || []).forEach((p) => {
            const key = `${p.line_item_id}_${p.provider_id}`;
            pricesMap[key] = p.unit_price == null ? "" : String(p.unit_price);
            const taxes = parseTaxesFromNotes(p.notes);
            vatMap[key] = taxes.vat == null ? "" : String(taxes.vat);
            isrMap[key] = taxes.isr == null ? "" : String(taxes.isr);
        });

        setPrices(pricesMap);
        setVatPercentages(vatMap);
        setIsrPercentages(isrMap);
        const selectedMap = {};
        (data.selections || []).forEach((s) => {
            const lineItemId = Number(s?.line_item_id || 0);
            const providerId = Number(s?.provider_id || 0);
            if (lineItemId && providerId) selectedMap[lineItemId] = providerId;
        });
        setSelectedByItem(selectedMap);

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

    useEffect(() => {
        setItemImagePreviews((prev) => {
            Object.values(prev).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
            return {};
        });
        requestedItemImagesRef.current = new Set();
    }, [id]);

    const handlePriceChange = (itemId, providerId, val) => {
        const key = `${itemId}_${providerId}`;
        const clean = sanitizePriceInput(val);
        if (clean !== "" && !/^\d*\.?\d{0,4}$/.test(clean)) return;

        setPrices((prev) => ({ ...prev, [key]: clean }));
        if (clean !== "" && vatPercentages[key] === undefined) {
            setVatPercentages((prev) => ({ ...prev, [key]: "16" }));
        }
    };

    const handlePriceBlur = (itemId, providerId) => {
        const key = `${itemId}_${providerId}`;
        setEditingPriceKey(null);
        setPrices((prev) => ({
            ...prev,
            [key]: normalizePriceInput(prev[key]),
        }));
    };

    const toggleVatForKey = (itemId, providerId) => {
        const key = `${itemId}_${providerId}`;
        setVatPercentages((prev) => ({
            ...prev,
            [key]: prev[key] === "" || prev[key] == null ? "16" : "",
        }));
    };

    const handleVatChange = (itemId, providerId, val) => {
        const key = `${itemId}_${providerId}`;
        if (val === "") {
            setVatPercentages((prev) => ({ ...prev, [key]: "" }));
            return;
        }
        const n = Number(val);
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(0, Math.min(100, n));
        setVatPercentages((prev) => ({ ...prev, [key]: String(clamped) }));
    };

    const toggleIsrForKey = (itemId, providerId) => {
        const key = `${itemId}_${providerId}`;
        setIsrPercentages((prev) => ({
            ...prev,
            [key]: prev[key] === "" || prev[key] == null ? "1.25" : "",
        }));
    };

    const handleIsrChange = (itemId, providerId, val) => {
        const key = `${itemId}_${providerId}`;
        if (val === "") {
            setIsrPercentages((prev) => ({ ...prev, [key]: "" }));
            return;
        }
        const n = Number(val);
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(0, Math.min(100, n));
        setIsrPercentages((prev) => ({ ...prev, [key]: String(clamped) }));
    };

    const calculateProviderBreakdown = (providerId) => {
        let subtotal = 0;
        let iva = 0;
        let isr = 0;
        items.forEach((item) => {
        const key = `${item.id}_${providerId}`;
        const price = parseFloat(prices[key]) || 0;
        const base = price * Number(item.quantity || 0);
        const vatPct = Number(vatPercentages[key]);
        const hasVat = Number.isFinite(vatPct) && vatPct > 0;
        const isrPct = Number(isrPercentages[key]);
        const hasIsr = Number.isFinite(isrPct) && isrPct > 0;
        const vatAmount = hasVat ? (base * vatPct) / 100 : 0;
        const isrAmount = hasIsr ? (base * isrPct) / 100 : 0;
        subtotal += base;
        iva += vatAmount;
        isr += isrAmount;
        });
        return { subtotal, iva, isr, total: subtotal + iva - isr };
    };

    const providerHasAnyPrice = (providerId) => {
        return items.some((item) => {
        const k = `${item.id}_${providerId}`;
        const price = parseFloat(prices[k]);
        return Number.isFinite(price) && price > 0;
        });
    };

    const providerCatalogMap = useMemo(() => {
        const map = new Map();
        [...providersSuggested, ...allProviders, ...invitedProviders].forEach((p) => {
            if (p?.id != null) map.set(Number(p.id), p);
        });
        return map;
    }, [providersSuggested, allProviders, invitedProviders]);

    const visibleProviders = useMemo(() => {
        let list = Array.from(selectedProviderIds)
            .map((id) => providerCatalogMap.get(Number(id)))
            .filter(Boolean);

        if (list.length === 0) {
            list = invitedProviders.length > 0 ? invitedProviders : providersSuggested;
        }

        if (showOnlyResponded) {
        list = list.filter((p) => p.status === "responded" || providerHasAnyPrice(p.id));
        }

        const q = tableSearch.toLowerCase();
        if (q) list = list.filter((p) => (p.name || "").toLowerCase().includes(q));

        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedProviderIds,
        providerCatalogMap,
        invitedProviders,
        providersSuggested,
        tableSearch,
        showOnlyResponded,
        prices,
        vatPercentages,
        isrPercentages,
        items,
    ]);

    const providerBreakdownMap = useMemo(() => {
        const map = {};
        visibleProviders.forEach((prov) => {
        map[prov.id] = calculateProviderBreakdown(prov.id);
        });
        return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleProviders, items, prices, vatPercentages, isrPercentages]);

    const renderedItems = useMemo(
        () => items.slice(0, visibleItemCount),
        [items, visibleItemCount]
    );

    useEffect(() => {
        let cancelled = false;
        const toLoad = items
            .map((item) => Number(item?.id || 0))
            .filter((itemId) => itemId > 0 && !requestedItemImagesRef.current.has(itemId));

        if (!toLoad.length) return () => {};

        const loadImages = async () => {
            const entries = await Promise.all(
                toLoad.map(async (itemId) => {
                    try {
                        const resp = await fetch(`${API_URL}/requisiciones/${id}/items/${itemId}/image`, {
                            headers: getAuthHeaders(),
                        });
                        if (!resp.ok) return null;
                        const blob = await resp.blob();
                        const url = URL.createObjectURL(blob);
                        return [String(itemId), url];
                    } catch {
                        return null;
                    }
                })
            );

            toLoad.forEach((itemId) => requestedItemImagesRef.current.add(itemId));

            if (cancelled) {
                entries.forEach((entry) => {
                    if (entry?.[1]) URL.revokeObjectURL(entry[1]);
                });
                return;
            }

            setItemImagePreviews((prev) => {
                const next = { ...prev };
                entries.filter(Boolean).forEach(([itemId, url]) => {
                    if (next[itemId]) URL.revokeObjectURL(next[itemId]);
                    next[itemId] = url;
                });
                return next;
            });
        };

        loadImages();

        return () => {
            cancelled = true;
        };
    }, [items, id]);

    useEffect(() => {
        setVisibleItemCount(ITEM_CHUNK_SIZE);
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    }, [id, items.length]);

    const handleTableScroll = (e) => {
        const el = e.currentTarget;
        const nearBottom =
            el.scrollHeight - (el.scrollTop + el.clientHeight) <= ITEM_SCROLL_THRESHOLD_PX;
        if (!nearBottom) return;
        if (visibleItemCount >= items.length) return;
        setVisibleItemCount((prev) => Math.min(prev + ITEM_CHUNK_SIZE, items.length));
    };

    const selectedCountByProvider = useMemo(() => {
        const map = {};
        Object.values(selectedByItem).forEach((providerId) => {
            const pid = Number(providerId || 0);
            if (!pid) return;
            map[pid] = (map[pid] || 0) + 1;
        });
        return map;
    }, [selectedByItem]);

    const providerCountForFlow = useMemo(() => {
        if (selectedProviderIds.size > 0) return selectedProviderIds.size;
        return invitedProviders.length;
    }, [selectedProviderIds, invitedProviders]);

    const hasMinimumProviders = providerCountForFlow >= 3;
    const capturedProvidersCount = useMemo(
        () => invitedProviders.filter((p) => p.status === "responded").length,
        [invitedProviders]
    );
    const hasMinimumCaptures = capturedProvidersCount >= 3;

    const openModal = () => {
        if (isReader) {
        toast.warning("Solo lectura");
        return;
        }
        if (isClosed) {
        toast.warning("Recepción finalizada");
        return;
        }

        const current =
            selectedProviderIds.size > 0
                ? new Set(selectedProviderIds)
                : new Set(
                    (invitedProviders.length > 0 ? invitedProviders : providersSuggested).map((p) =>
                        Number(p.id)
                    )
                );
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

    const applySelectedProviders = async () => {
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
        setApplyingProviders(true);
        setSelectedProviderIds(new Set(provider_ids));
        setIsModalOpen(false);
        toast.success("Proveedores listos para comparar");
        } finally {
        setApplyingProviders(false);
        }
    };

    const handleSaveChanges = async () => {
        if (isReader) {
        toast.warning("Solo lectura");
        return;
        }
        if (isClosed) {
        toast.error("Recepción finalizada. Reabre la recepción para poder guardar.");
        return;
        }
        if (saving) return;

        const selected =
        selectedProviderIds.size > 0
            ? new Set(Array.from(selectedProviderIds).map((x) => Number(x)))
            : new Set((invitedProviders || []).map((p) => Number(p.id)).filter(Boolean));

        if (selected.size === 0) {
        toast.warning("No hay proveedores disponibles para comparar");
        return;
        }
        const payload = [];
        const keys = new Set([
            ...Object.keys(prices),
            ...Object.keys(vatPercentages),
            ...Object.keys(isrPercentages),
        ]);

        keys.forEach((key) => {
        const [itemId, providerId] = key.split("_");

        const unit_price = parseFloat(prices[key]);
        const hasPrice = Number.isFinite(unit_price) && unit_price >= 0;
        if (!hasPrice) return;

        const provider_id = parseInt(providerId, 10);
        if (!selected.has(provider_id)) return;

        const vatRaw = vatPercentages[key];
        const vat_percentage =
            vatRaw === "" || vatRaw == null ? null : Number(vatRaw);

        if (
            vat_percentage != null &&
            (!Number.isFinite(vat_percentage) || vat_percentage < 0 || vat_percentage > 100)
        ) {
            return;
        }

        const isrRaw = isrPercentages[key];
        const isr_percentage =
            isrRaw === "" || isrRaw == null ? null : Number(isrRaw);
        if (
            isr_percentage != null &&
            (!Number.isFinite(isr_percentage) || isr_percentage < 0 || isr_percentage > 100)
        ) {
            return;
        }

        payload.push({
            line_item_id: parseInt(itemId, 10),
            provider_id,
            unit_price: Number.isFinite(unit_price) ? unit_price : 0,
            offered_description: "",
            vat_percentage,
            isr_percentage,
            notes: "",
            is_winner: 0,
        });
        });

        try {
        setSaving(true);

        const response = await fetch(`${API_URL}/cotizacion/${id}/prices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
                prices: payload,
                selected_provider_ids: Array.from(selected),
            }),
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
        if (isReader) {
        toast.warning("Solo lectura");
        return;
        }
        if (!hasMinimumProviders) {
        toast.warning("Debes tener al menos 3 proveedores para cerrar recepción");
        return;
        }
        if (!hasMinimumCaptures) {
        toast.warning("Debes tener al menos 3 cotizaciones capturadas para cerrar recepción");
        return;
        }
        if (closing) return;
        setConfirmCloseOpen(true);
    };

    const confirmCloseInvites = async () => {
        if (isReader) return;
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
        if (isReader) return;
        if (!canSendToReview) {
        toast.warning("No tienes permiso para enviar a revisión interna");
        return;
        }
        if (!hasMinimumProviders) {
        toast.warning("Debes tener al menos 3 proveedores para enviar a revisión");
        return;
        }
        if (!hasMinimumCaptures) {
        toast.warning("Debes tener al menos 3 cotizaciones capturadas para enviar a revisión");
        return;
        }
        if (sendingReview) return;
        setConfirmSendOpen(false);
        const toastId = toast.loading("Enviando a revisión interna...");
        try {
        setSendingReview(true);
        const response = await fetch(`${API_URL}/cotizacion/${id}/send-review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Error al enviar a revisión interna");

        toast.success(data?.message || "Enviado a revisión interna", { id: toastId });
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
        if (isReader) {
        toast.warning("Solo lectura");
        return;
        }
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

    const openExcelPreview = () => {
        navigate(`/compras/orden/${id}?vista=excel`);
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
            description={`Se marcarán como 'Sin respuesta' los proveedores que sigan en 'Invitado'. Requisito: mínimo 3 proveedores y 3 cotizaciones capturadas. Actualmente: ${providerCountForFlow} proveedores y ${capturedProvidersCount} capturas.`}
            confirmText="Sí, cerrar recepción"
            cancelText="Cancelar"
            onConfirm={confirmCloseInvites}
            onCancel={() => setConfirmCloseOpen(false)}
        />
        <ConfirmModal
            open={confirmSendOpen}
            title="Enviar a revisión interna"
            headerText="Confirmar envío"
            description="La requisición pasará a revisión interna de Compras para que Compras Admin haga la selección final por partida."
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
                <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">Cotización #{id}</h1>
                {isClosed && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                    {Number(requisition?.statuses_id) === 14 ? "En revisión interna" : "Recepción cerrada"}
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

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                    hasMinimumProviders
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                }`}>
                Proveedores: {providerCountForFlow} / mínimo 3
                </div>
                <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                    hasMinimumCaptures
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-yellow-50 text-yellow-700 border-yellow-200"
                }`}>
                Capturas: {capturedProvidersCount} / mínimo 3
                </div>
                <div className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                    type="checkbox"
                    checked={showOnlyResponded}
                    onChange={(e) => setShowOnlyResponded(e.target.checked)}
                    />
                    Solo respondieron
                </label>
                </div>

                <div className="relative w-full md:w-64 md:ml-1">
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
                disabled={saving || isClosed || isReader || visibleProviders.length === 0}
                className={`bg-[#8B1D35] hover:bg-[#72182b] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap ${
                    saving || isClosed || isReader || visibleProviders.length === 0 ? "opacity-60 cursor-not-allowed hover:bg-[#8B1D35]" : ""
                }`}
                title={isReader ? "Solo lectura" : isClosed ? "Recepción finalizada: no editable" : "Guardar cambios"}
                >
                <Save size={14} />
                {saving ? "GUARDANDO..." : "GUARDAR"}
                </button>
            </div>
        </div>

        {/* ✅ MENSAJE CLARO CUANDO ESTÁ CERRADA */}
        {isClosed && <CotizacionClosedNotice requisition={requisition} />}

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-2 text-[#8B1D35]">
                <CheckCircle2 size={16} />
                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wide">
                    Cuadro Comparativo
                </h3>
                </div>

                <div className="flex items-center gap-3">
                <button
                    onClick={openExcelPreview}
                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                    title="Vista previa y descarga del Excel"
                >
                    <FileText size={13} />
                    EXCEL
                </button>
                {!isClosed && !isReader && (
                    <button
                    onClick={handleCloseInvites}
                    disabled={closing || !hasMinimumProviders || !hasMinimumCaptures}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 ${
                        closing || !hasMinimumProviders || !hasMinimumCaptures ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    >
                    {closing ? "CERRANDO..." : "CERRAR RECEPCIÓN"}
                    </button>
                )}

                {Boolean(requisition?.quotation_closed_at) && Number(requisition?.statuses_id) === 12 && !isReader && (
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

                {Boolean(requisition?.quotation_closed_at) && Number(requisition?.statuses_id) === 12 && !isReader && canSendToReview && (
                    <button
                    onClick={() => setConfirmSendOpen(true)}
                    disabled={sendingReview || !hasMinimumProviders || !hasMinimumCaptures}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg bg-[#8B1D35] text-white shadow-sm hover:bg-[#72182b] ${
                        sendingReview || !hasMinimumProviders || !hasMinimumCaptures ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    >
                    {sendingReview ? "ENVIANDO..." : "ENVIAR A REVISIÓN INTERNA"}
                    </button>
                )}

                <button
                    onClick={openModal}
                    disabled={isClosed || isReader}
                    className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                    isClosed || isReader
                        ? "text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed"
                        : "text-white border-[#8B1D35] bg-[#8B1D35] hover:bg-[#72182b] shadow-sm"
                    }`}
                    title={
                        isReader
                            ? "Solo lectura"
                            : isClosed
                            ? "Recepción finalizada"
                            : "Agregar o quitar proveedores para el comparativo"
                    }
                >
                    <Users size={13} />
                    {providerCountForFlow > 0
                        ? `EDITAR PROVEEDORES (${providerCountForFlow})`
                        : "AGREGAR PROVEEDORES"}
                </button>
                </div>
            </div>

            <div
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className="overflow-auto max-h-[calc(100vh-240px)]"
            >
                <table className="min-w-max w-full text-xs text-left border-collapse">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                    <th className="sticky left-0 z-30 bg-gray-50 px-1 py-2 min-w-[34px] border-r border-gray-300 text-gray-700 font-bold text-center">
                        Partida
                    </th>
                    <th className="sticky left-[34px] z-30 bg-gray-50 px-1 py-2 min-w-[44px] border-r border-gray-300 text-gray-700 font-bold text-center">
                        Cantidad
                    </th>
                    <th className="sticky left-[78px] z-30 bg-gray-50 px-1 py-2 min-w-[52px] border-r border-gray-300 text-gray-700 font-bold text-center">
                        Unidad
                    </th>
                    <th className="sticky left-[130px] z-30 bg-gray-50 px-2 py-2 w-[170px] min-w-[170px] max-w-[170px] border-r border-gray-300 text-gray-700 font-bold">
                        Descripción ({items.length})
                    </th>
                    <th className="sticky left-[300px] z-30 bg-gray-50 px-1 py-2 w-[68px] min-w-[68px] max-w-[68px] border-r border-gray-300 text-gray-700 font-bold text-center">
                        Img
                    </th>

                    {visibleProviders.length === 0 && (
                        <th className="px-4 py-3 text-xs text-gray-400 normal-case">
                        Sin proveedores seleccionados
                        </th>
                    )}
                    {visibleProviders.map((prov) => (
                        <th
                        key={prov.id}
                        className="px-1.5 py-2 min-w-[170px] border-r border-gray-200 text-center font-semibold text-gray-600 bg-gray-50"
                        title={prov.status ? `Status: ${statusLabel(prov.status)}` : prov.name}
                        >
                        <div className="max-w-[148px] mx-auto text-[11px] leading-tight line-clamp-2 break-words">
                            {prov.name}
                        </div>
                        {prov.status && (
                            <div className="text-[10px] mt-1 text-gray-400 capitalize">
                            {statusLabel(prov.status)}
                            </div>
                        )}
                        {selectedCountByProvider[prov.id] > 0 && (
                            <div className="text-[10px] mt-1 font-bold text-[#8B1D35]">
                            Seleccionado en {selectedCountByProvider[prov.id]} partida(s)
                            </div>
                        )}
                        </th>
                    ))}
                    </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                    {renderedItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 px-1 py-2 border-r border-gray-200 text-center">
                        <div className="font-bold text-gray-700 text-xs">{idx + 1}</div>
                        </td>
                        <td className="sticky left-[34px] z-20 bg-white group-hover:bg-gray-50 px-1 py-2 border-r border-gray-200 text-center">
                        <div className="font-semibold text-gray-700 text-xs">{item.quantity}</div>
                        </td>
                        <td className="sticky left-[78px] z-20 bg-white group-hover:bg-gray-50 px-1 py-2 border-r border-gray-200 text-center">
                        <div className="font-semibold text-gray-700 text-xs">{item.unidad_medida || "—"}</div>
                        </td>
                        <td className="sticky left-[130px] z-20 bg-white group-hover:bg-gray-50 px-2 py-2 border-r border-gray-200 w-[170px] min-w-[170px] max-w-[170px]">
                        <div
                            className="font-bold text-gray-700 text-xs leading-tight line-clamp-3 break-words"
                            title={item.description || ""}
                        >
                            {item.description}
                        </div>
                        </td>
                        <td className="sticky left-[300px] z-20 bg-white group-hover:bg-gray-50 px-1 py-2 border-r border-gray-200 w-[68px] min-w-[68px] max-w-[68px] text-center">
                        {itemImagePreviews[String(item.id)] ? (
                            <button
                                type="button"
                                className="h-9 w-9 rounded border border-[#8B1D35]/20 overflow-hidden inline-flex"
                                title="Abrir imagen"
                                onClick={() =>
                                    window.open(
                                        itemImagePreviews[String(item.id)],
                                        "_blank",
                                        "noopener,noreferrer"
                                    )
                                }
                            >
                                <img
                                    src={itemImagePreviews[String(item.id)]}
                                    alt={`Imagen partida ${idx + 1}`}
                                    className="h-full w-full object-cover"
                                />
                            </button>
                        ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                        )}
                        </td>

                        {visibleProviders.map((prov) => {
                        const k = `${item.id}_${prov.id}`;
                        const isSelectedFinal = Number(selectedByItem[item.id] || 0) === Number(prov.id);
                        const vatValue = vatPercentages[k] ?? "";
                        const hasVat = vatValue !== "";
                        const isrValue = isrPercentages[k] ?? "";
                        const hasIsr = isrValue !== "";
                        return (
                            <td
                            key={prov.id}
                            className={`border-r border-gray-100 relative align-top ${
                                isSelectedFinal
                                    ? "bg-[#8B1D35]/10 group-hover:bg-[#8B1D35]/10"
                                    : "bg-white group-hover:bg-gray-50"
                            }`}
                            >
                            <div
                                className={`mx-1.5 my-1.5 rounded-md border px-1.5 py-1.5 ${
                                    isSelectedFinal ? "border-[#8B1D35]/40 bg-[#8B1D35]/10" : "border-gray-200 bg-white"
                                } focus-within:ring-2 focus-within:ring-[#8B1D35]/20 focus-within:border-[#8B1D35]`}
                            >
                                <div className="relative">
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">$</div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*[.]?[0-9]*"
                                        placeholder="0.00"
                                        disabled={isClosed}
                                        value={
                                            editingPriceKey === k
                                                ? prices[k] ?? ""
                                                : formatPriceInput(prices[k] ?? "")
                                        }
                                        className={`w-full text-right text-[11px] py-0.5 pr-1 bg-transparent outline-none font-semibold text-gray-700 pl-4 ${
                                            isClosed ? "opacity-60 cursor-not-allowed" : ""
                                        }`}
                                        onFocus={(e) => {
                                            setEditingPriceKey(k);
                                            e.currentTarget.select();
                                        }}
                                        onBlur={() => handlePriceBlur(item.id, prov.id)}
                                        onChange={(e) => handlePriceChange(item.id, prov.id, e.target.value)}
                                    />
                                </div>

                                <div className="mt-1 flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={isClosed}
                                        onClick={() => toggleVatForKey(item.id, prov.id)}
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                            hasVat
                                                ? "bg-[#8B1D35]/10 text-[#8B1D35] border-[#8B1D35]/30"
                                                : "bg-gray-50 text-gray-500 border-gray-200"
                                        } ${isClosed ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-100"}`}
                                    >
                                        IVA
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="16"
                                        disabled={isClosed || !hasVat}
                                        value={vatValue}
                                        onChange={(e) => handleVatChange(item.id, prov.id, e.target.value)}
                                        className={`w-12 text-[10px] px-1 py-0.5 border rounded outline-none ${
                                            isClosed ? "opacity-60 cursor-not-allowed" : ""
                                        } ${!hasVat ? "bg-gray-50 text-gray-400 border-gray-200" : "bg-white border-gray-300 text-gray-700"}`}
                                    />
                                    <span className="text-[10px] text-gray-500">%</span>
                                </div>

                                <div className="mt-1 flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={isClosed}
                                        onClick={() => toggleIsrForKey(item.id, prov.id)}
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                            hasIsr
                                                ? "bg-blue-100 text-blue-700 border-blue-300"
                                                : "bg-gray-50 text-gray-500 border-gray-200"
                                        } ${isClosed ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-100"}`}
                                    >
                                        ISR
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="1.25"
                                        disabled={isClosed || !hasIsr}
                                        value={isrValue}
                                        onChange={(e) => handleIsrChange(item.id, prov.id, e.target.value)}
                                        className={`w-12 text-[10px] px-1 py-0.5 border rounded outline-none ${
                                            isClosed ? "opacity-60 cursor-not-allowed" : ""
                                        } ${!hasIsr ? "bg-gray-50 text-gray-400 border-gray-200" : "bg-white border-gray-300 text-gray-700"}`}
                                    />
                                    <span className="text-[10px] text-gray-500">%</span>
                                </div>
                            </div>
                            </td>
                        );
                        })}
                    </tr>
                    ))}

                    {renderedItems.length < items.length && (
                    <tr>
                            <td
                            colSpan={5 + Math.max(visibleProviders.length, 1)}
                            className="px-4 py-3 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200"
                        >
                            Mostrando {renderedItems.length} de {items.length} partidas. Desplázate para cargar más.
                        </td>
                    </tr>
                    )}

                    <tr className="bg-gray-100 font-bold text-xs border-t border-gray-300">
                    <td className="sticky left-0 z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[34px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[78px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[130px] z-30 bg-gray-100 px-4 py-3 border-r border-gray-300 text-right uppercase text-gray-600">
                        Sub Total:
                    </td>
                    <td className="sticky left-[300px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />

                    {visibleProviders.map((prov) => {
                        const subtotal = Number(providerBreakdownMap[prov.id]?.subtotal || 0);
                        return (
                        <td
                            key={prov.id}
                            className={`px-2 py-3 text-right pr-2 border-r border-gray-200 ${
                            subtotal > 0 ? "text-gray-700" : "text-gray-400"
                            }`}
                        >
                            {subtotal > 0
                            ? `$${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </td>
                        );
                    })}
                    </tr>

                    <tr className="bg-gray-100 font-bold text-xs border-t border-gray-300">
                    <td className="sticky left-0 z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[34px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[78px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[130px] z-30 bg-gray-100 px-4 py-3 border-r border-gray-300 text-right uppercase text-gray-600">
                        I.V.A:
                    </td>
                    <td className="sticky left-[300px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />

                    {visibleProviders.map((prov) => {
                        const iva = Number(providerBreakdownMap[prov.id]?.iva || 0);
                        return (
                        <td
                            key={prov.id}
                            className={`px-2 py-3 text-right pr-2 border-r border-gray-200 ${
                            iva > 0 ? "text-gray-700" : "text-gray-400"
                            }`}
                        >
                            {iva > 0
                            ? `$${iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </td>
                        );
                    })}
                    </tr>

                    <tr className="bg-gray-100 font-bold text-xs border-t border-gray-300">
                    <td className="sticky left-0 z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[34px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[78px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[130px] z-30 bg-gray-100 px-4 py-3 border-r border-gray-300 text-right uppercase text-gray-600">
                        I.S.R. (-):
                    </td>
                    <td className="sticky left-[300px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />

                    {visibleProviders.map((prov) => {
                        const isr = Number(providerBreakdownMap[prov.id]?.isr || 0);
                        return (
                        <td
                            key={prov.id}
                            className={`px-2 py-3 text-right pr-2 border-r border-gray-200 ${
                            isr > 0 ? "text-blue-700" : "text-gray-400"
                            }`}
                        >
                            {isr > 0
                            ? `-$${isr.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </td>
                        );
                    })}
                    </tr>

                    <tr className="bg-gray-100 font-bold text-xs border-t border-gray-300">
                    <td className="sticky left-0 z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[34px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[78px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />
                    <td className="sticky left-[130px] z-30 bg-gray-100 px-4 py-3 border-r border-gray-300 text-right uppercase text-gray-600">
                        Total Cotización:
                    </td>
                    <td className="sticky left-[300px] z-30 bg-gray-100 px-2 py-3 border-r border-gray-300" />

                    {visibleProviders.map((prov) => {
                        const total = Number(providerBreakdownMap[prov.id]?.total || 0);
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

        {/* MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={() => !applyingProviders && setIsModalOpen(false)} />

            <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div>
                    <h3 className="font-bold text-gray-800">Seleccionar proveedores</h3>
                    <p className="text-xs text-gray-500">Sugeridos por categoría o busca en todos.</p>
                </div>

                <button onClick={() => !applyingProviders && setIsModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
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
                            disabled={applyingProviders || isClosed}
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
                        disabled={applyingProviders || isClosed}
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
                    disabled={applyingProviders}
                    className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                    Cancelar
                    </button>

                    <button
                    onClick={applySelectedProviders}
                    disabled={applyingProviders || selectedProviderIds.size === 0 || isClosed}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-[#8B1D35] text-white hover:bg-[#72182b] disabled:opacity-60"
                    >
                    {applyingProviders ? "APLICANDO..." : "APLICAR"}
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}
        </div>
    );
}
