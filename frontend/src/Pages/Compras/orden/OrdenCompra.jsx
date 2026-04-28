import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle2, Briefcase, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "../../../components/ConfirmModal";
import { API_BASE_URL } from "../../../api/config";
import { getRequisitionUnitLabel } from "../../../utils/unitDisplay";

const API_URL = `${API_BASE_URL}/compras`;
const DEFAULT_DELIVERY_PLACE = "UAYS CUALTOS";

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

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

export default function OrdenCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === "compras_admin";
  const isOperator = user?.role === "compras_operador";
  const isReader = user?.role === "compras_lector";
  const isExcelPreviewMode = searchParams.get("vista") === "excel";

  const [loading, setLoading] = useState(true);
  const [requisition, setRequisition] = useState(null);
  const [items, setItems] = useState([]);
  const [providersInfo, setProvidersInfo] = useState([]);
  const [summary, setSummary] = useState({
    total_items: 0,
    selected_items: 0,
    missing_items: 0,
    is_complete: false,
    last_selection_at: null,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadProviderId, setDownloadProviderId] = useState("");
  const [metaByProvider, setMetaByProvider] = useState({});
  const [orderType, setOrderType] = useState("compra");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("contado");
  const [paymentAdvance, setPaymentAdvance] = useState(false);
  const [deliveryPlace, setDeliveryPlace] = useState(DEFAULT_DELIVERY_PLACE);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState("");
  const [advancePercentage, setAdvancePercentage] = useState("");
  const [paymentCompliance, setPaymentCompliance] = useState(false);
  const [savingOrderSetup, setSavingOrderSetup] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [autoAssigningFolios, setAutoAssigningFolios] = useState(false);
  const isFinalized = Number(requisition?.statuses_id || 0) === 11;
  const canEditOrderSetup = (isAdmin || isOperator) && !isFinalized;
  const editableInputClass =
    "mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-[#fffaf8] border-[#8B1D35]/35 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none";
  const blockedInputClass =
    "mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed outline-none";

  const toInputDate = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "";
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_URL}/requisiciones/${id}/seleccion`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error cargando selección");

      setRequisition(data.requisition || null);
      const safeItems = Array.isArray(data.items) ? data.items : [];

      // Refuerza producto desde el mismo endpoint que usan otros modales de compras.
      // Evita casos históricos donde en selección llega vacío product_name.
      let mergedItems = safeItems;
      try {
        const itemsResp = await fetch(`${API_URL}/requisiciones/${id}/items`, {
          headers: getAuthHeaders(),
        });
        const itemsData = await itemsResp.json().catch(() => []);
        if (itemsResp.ok && Array.isArray(itemsData) && itemsData.length > 0) {
          const productByItemId = new Map(
            itemsData.map((row) => [Number(row.id), String(row.product_name || "").trim()])
          );
          mergedItems = safeItems.map((item) => {
            const currentProduct = String(item?.product_name || "").trim();
            if (currentProduct) return item;
            const fallbackProduct = productByItemId.get(Number(item?.id)) || "";
            return fallbackProduct
              ? { ...item, product_name: fallbackProduct }
              : item;
          });
        }
      } catch {
        // Si falla el refuerzo, mantener flujo principal sin bloquear pantalla.
      }

      setItems(mergedItems);
      setSummary(
        data.summary || {
          total_items: 0,
          selected_items: 0,
          missing_items: 0,
          is_complete: false,
          last_selection_at: null,
        }
      );
      if (data.requisition?.order_type) {
        setOrderType(
          String(data.requisition.order_type).toLowerCase() === "servicio"
            ? "servicio"
            : "compra"
        );
      }

      const metaResp = await fetch(`${API_URL}/orden/${id}/meta`, {
        headers: getAuthHeaders(),
      });
      const metaData = await metaResp.json().catch(() => ([]));
      if (metaResp.ok && Array.isArray(metaData)) {
        const map = {};
        const uniqueFolios = new Set();
        const uniquePaymentModes = new Set();
        const uniqueDeliveryPlaces = new Set();
        const uniqueDeliveryDates = new Set();
        const uniquePaymentStartDates = new Set();
        const uniquePaymentEndDates = new Set();
        const uniquePaymentDates = new Set();
        const uniqueInstallments = new Set();
        const uniqueAdvancePercentages = new Set();
        let hasAdvance = false;
        let hasCompliance = false;
        metaData.forEach((m) => {
          map[m.provider_id] = {
            folio: m.folio || "",
            oc_payment_mode:
              String(m.oc_payment_mode || "").toLowerCase() === "parcialidades"
                ? "parcialidades"
                : "contado",
            oc_payment_anticipo: Number(m.oc_payment_anticipo || 0) === 1,
            oc_delivery_place: m.oc_delivery_place || "",
            oc_delivery_date: toInputDate(m.oc_delivery_date),
            oc_payment_start_date: toInputDate(m.oc_payment_start_date),
            oc_payment_end_date: toInputDate(m.oc_payment_end_date),
            oc_payment_date: toInputDate(m.oc_payment_date),
            oc_installments_count:
              m.oc_installments_count == null ? "" : String(m.oc_installments_count),
            oc_advance_percentage:
              m.oc_advance_percentage == null ? "" : String(m.oc_advance_percentage),
            oc_payment_compliance: Number(m.oc_payment_compliance || 0) === 1,
          };
          const folio = String(m.folio || "").trim();
          if (folio) uniqueFolios.add(folio);
          const mode =
            String(m.oc_payment_mode || "").toLowerCase() === "parcialidades"
              ? "parcialidades"
              : "contado";
          uniquePaymentModes.add(mode);
          const place = String(m.oc_delivery_place || "").trim();
          if (place) uniqueDeliveryPlaces.add(place);
          const delDate = toInputDate(m.oc_delivery_date);
          const startDate = toInputDate(m.oc_payment_start_date);
          const endDate = toInputDate(m.oc_payment_end_date);
          const payDate = toInputDate(m.oc_payment_date);
          const installments =
            m.oc_installments_count == null ? "" : String(m.oc_installments_count).trim();
          const advancePct =
            m.oc_advance_percentage == null ? "" : String(m.oc_advance_percentage).trim();
          if (delDate) uniqueDeliveryDates.add(delDate);
          if (startDate) uniquePaymentStartDates.add(startDate);
          if (endDate) uniquePaymentEndDates.add(endDate);
          if (payDate) uniquePaymentDates.add(payDate);
          if (installments) uniqueInstallments.add(installments);
          if (advancePct) uniqueAdvancePercentages.add(advancePct);
          if (Number(m.oc_payment_anticipo || 0) === 1) hasAdvance = true;
          if (Number(m.oc_payment_compliance || 0) === 1) hasCompliance = true;
        });
        setMetaByProvider(map);
        setOrderNumber(uniqueFolios.size ? Array.from(uniqueFolios).join(", ") : "");
        setPaymentMode(uniquePaymentModes.has("parcialidades") ? "parcialidades" : "contado");
        setPaymentAdvance(hasAdvance);
        setDeliveryPlace(
          uniqueDeliveryPlaces.size
            ? Array.from(uniqueDeliveryPlaces)[0]
            : DEFAULT_DELIVERY_PLACE
        );
        setDeliveryDate(uniqueDeliveryDates.size ? Array.from(uniqueDeliveryDates)[0] : "");
        setPaymentStartDate(
          uniquePaymentStartDates.size ? Array.from(uniquePaymentStartDates)[0] : ""
        );
        setPaymentEndDate(uniquePaymentEndDates.size ? Array.from(uniquePaymentEndDates)[0] : "");
        setPaymentDate(uniquePaymentDates.size ? Array.from(uniquePaymentDates)[0] : "");
        setInstallmentsCount(uniqueInstallments.size ? Array.from(uniqueInstallments)[0] : "");
        setAdvancePercentage(
          uniqueAdvancePercentages.size ? Array.from(uniqueAdvancePercentages)[0] : ""
        );
        setPaymentCompliance(hasCompliance);
      } else {
        setMetaByProvider({});
        setOrderNumber("");
        setPaymentMode("contado");
        setPaymentAdvance(false);
        setDeliveryPlace(DEFAULT_DELIVERY_PLACE);
        setDeliveryDate("");
        setPaymentStartDate("");
        setPaymentEndDate("");
        setPaymentDate("");
        setInstallmentsCount("");
        setAdvancePercentage("");
        setPaymentCompliance(false);
      }

      setProvidersInfo(Array.isArray(data.providers) ? data.providers : []);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo cargar la selección");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rows = useMemo(() => {
    return items.map((it) => {
      const unit = Number(it.selected_unit_price);
      const qty = Number(it.quantity || 0);
      const subtotal = Number.isFinite(unit) ? unit * qty : 0;
      const vatPct = Number(it.selected_vat_percentage);
      const isrPct = Number(it.selected_isr_percentage);
      const safeVatPct = Number.isFinite(vatPct) && vatPct > 0 ? vatPct : 0;
      const safeIsrPct = Number.isFinite(isrPct) && isrPct > 0 ? isrPct : 0;
      const vatAmount = (subtotal * safeVatPct) / 100;
      const isrAmount = (subtotal * safeIsrPct) / 100;
      const total = subtotal + vatAmount - isrAmount;
      return { ...it, subtotal, vatPct: safeVatPct, isrPct: safeIsrPct, vatAmount, isrAmount, total };
    });
  }, [items]);

  const providersList = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!r.provider_id) return;
      if (!map.has(r.provider_id)) {
        map.set(r.provider_id, { id: r.provider_id, name: r.provider_name || "Proveedor" });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  useEffect(() => {
    if (providersList.length === 0) {
      setDownloadProviderId("");
      return;
    }
    const currentSelected = Number(downloadProviderId);
    const exists = providersList.some((provider) => Number(provider.id) === currentSelected);
    if (!exists) {
      setDownloadProviderId(String(providersList[0].id));
    }
  }, [providersList, downloadProviderId]);

  useEffect(() => {
    if (!canEditOrderSetup || isFinalized || loading || autoAssigningFolios || providersList.length === 0)
      return;
    const missingProviders = providersList.filter(
      (provider) => !String(metaByProvider[provider.id]?.folio || "").trim()
    );
    if (missingProviders.length === 0) return;

    const assignFolios = async () => {
      try {
        setAutoAssigningFolios(true);
        const headers = { "Content-Type": "application/json", ...getAuthHeaders() };
        for (const provider of missingProviders) {
          const existing = metaByProvider[provider.id] || {};
          const resp = await fetch(`${API_URL}/orden/${id}/meta`, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              provider_id: provider.id,
              folio: String(existing.folio || "").trim() || null,
              oc_payment_mode: existing.oc_payment_mode || paymentMode,
              oc_payment_anticipo:
                existing.oc_payment_anticipo != null
                  ? Number(existing.oc_payment_anticipo)
                  : paymentAdvance
                  ? 1
                  : 0,
              oc_delivery_place:
                String(existing.oc_delivery_place || "").trim() ||
                String(deliveryPlace || "").trim() ||
                DEFAULT_DELIVERY_PLACE,
              oc_delivery_date: String(existing.oc_delivery_date || "").trim() || null,
              oc_payment_start_date:
                String(existing.oc_payment_start_date || "").trim() || null,
              oc_payment_end_date: String(existing.oc_payment_end_date || "").trim() || null,
              oc_payment_date: String(existing.oc_payment_date || "").trim() || null,
              oc_installments_count:
                String(existing.oc_installments_count || "").trim() || null,
              oc_advance_percentage:
                String(existing.oc_advance_percentage || "").trim() || null,
              oc_payment_compliance:
                existing.oc_payment_compliance != null
                  ? Number(existing.oc_payment_compliance)
                  : paymentCompliance
                  ? 1
                  : 0,
            }),
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.message || "No se pudo asignar folio");
          }
        }
        await loadData();
      } catch (error) {
        console.error(error);
        toast.error(error?.message || "No se pudieron asignar folios automáticos");
      } finally {
        setAutoAssigningFolios(false);
      }
    };

    assignFolios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditOrderSetup, isFinalized, loading, autoAssigningFolios, providersList, metaByProvider, id]);

  const totalsByProvider = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.provider_name || "Sin proveedor";
      const prev = map.get(key) || 0;
      map.set(key, prev + (Number(r.total) || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [rows]);

  const totalGeneral = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  }, [rows]);

  const providerInfoMap = useMemo(() => {
    const map = new Map();
    providersInfo.forEach((p) => map.set(Number(p.id), p));
    return map;
  }, [providersInfo]);

  const providersWithMissingData = useMemo(() => {
    return providersList
      .map((provider) => {
        const info = providerInfoMap.get(Number(provider.id)) || {};
        const missing = [];
        if (!String(info.name || "").trim()) missing.push("Nombre");
        if (!String(info.razon_social || "").trim()) missing.push("Razón social");
        if (!String(info.rfc || "").trim()) missing.push("RFC");
        if (!String(info.phones || "").trim()) missing.push("Teléfono");
        if (!String(info.address || "").trim()) missing.push("Dirección");
        return {
          id: provider.id,
          name: info.name || provider.name || `Proveedor ${provider.id}`,
          missing,
        };
      })
      .filter((p) => p.missing.length > 0);
  }, [providersList, providerInfoMap]);

  const requisitionUnitLabel = useMemo(
    () => getRequisitionUnitLabel(requisition || {}, "Sin unidad"),
    [requisition]
  );

  const firstProviderMissingDataId = useMemo(() => {
    if (providersWithMissingData.length === 0) return null;
    const idValue = Number(providersWithMissingData[0]?.id);
    return Number.isFinite(idValue) ? idValue : null;
  }, [providersWithMissingData]);

  const validateFinalizePreconditions = () => {
    if (providersWithMissingData.length > 0) {
      const names = providersWithMissingData.map((p) => p.name || `ID ${p.id}`).join(", ");
      toast.error(`Faltan datos de proveedor (RFC/Dirección/Teléfono/Razón social) para: ${names}`);
      return false;
    }
    const missing = providersList.filter((p) => {
      const meta = metaByProvider[p.id] || {};
      return !String(meta.folio || "").trim();
    });
    if (missing.length) {
      const names = missing.map((p) => p.name || `ID ${p.id}`).join(", ");
      toast.error(`Falta folio para: ${names}`);
      return false;
    }
    return true;
  };

  const handleRequestFinalize = () => {
    if (saving) return;
    if (isReader) {
      toast.warning("Perfil de solo lectura");
      return;
    }
    if (isFinalized) {
      toast.warning("La requisición ya está finalizada");
      return;
    }
    if (!summary.is_complete) {
      toast.error(`Faltan ${summary.missing_items} partida(s) por seleccionar`);
      return;
    }
    if (!validateFinalizePreconditions()) return;
    setConfirmOpen(true);
  };

  const handleMarkCompleted = async () => {
    if (saving) return;
    if (isReader) {
      toast.warning("Perfil de solo lectura");
      return;
    }
    if (isFinalized) {
      toast.warning("La requisición ya está finalizada");
      return;
    }
    try {
      if (!validateFinalizePreconditions()) return;

      setSaving(true);
      const resp = await fetch(`${API_URL}/requisiciones/${id}/estatus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status_id: 11, comentarios: null }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error al actualizar estatus");

      toast.success("Requisición marcada como finalizada");
      navigate("/compras/historial");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo actualizar el estatus");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (providerId) => {
    if (downloading) return;
    try {
      if (providerId) {
        const meta = metaByProvider[providerId] || {};
        if (!String(meta.folio || "").trim()) {
          const name =
            providersList.find((p) => Number(p.id) === Number(providerId))?.name ||
            `ID ${providerId}`;
          toast.error(`Falta folio para: ${name}`);
          return;
        }
      }
      setDownloading(true);
      const params = providerId ? `?provider_id=${encodeURIComponent(providerId)}` : "";
      const resp = await fetch(`${API_URL}/orden/${id}/pdf${params}`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error("No se pudo generar el PDF");
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveOrderSetup = async () => {
    if (!canEditOrderSetup || savingOrderSetup || isFinalized) return;
    const cleanDeliveryPlace =
      String(deliveryPlace || "").trim() || DEFAULT_DELIVERY_PLACE;
    const cleanDeliveryDate = String(deliveryDate || "").trim();
    const cleanPaymentStartDate = String(paymentStartDate || "").trim();
    const cleanPaymentEndDate = String(paymentEndDate || "").trim();
    const cleanPaymentDate = String(paymentDate || "").trim();
    const cleanInstallmentsCount = String(installmentsCount || "").trim();
    const cleanAdvancePercentage = String(advancePercentage || "").trim();
    if (providersList.length === 0) {
      toast.error("No hay proveedores seleccionados para guardar");
      return;
    }

    try {
      setSavingOrderSetup(true);
      const headers = { "Content-Type": "application/json", ...getAuthHeaders() };

      const typeResp = await fetch(`${API_URL}/orden/${id}/type`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ order_type: orderType }),
      });
      const typeData = await typeResp.json().catch(() => ({}));
      if (!typeResp.ok) throw new Error(typeData?.message || "Error al guardar tipo de orden");

      const foliosAssigned = new Set();
      for (const provider of providersList) {
        const providerExistingFolio = String(metaByProvider[provider.id]?.folio || "").trim();
        const metaResp = await fetch(`${API_URL}/orden/${id}/meta`, {
          method: "PUT",
          headers,
              body: JSON.stringify({
                provider_id: provider.id,
                folio: providerExistingFolio || null,
                oc_payment_mode: paymentMode,
                oc_payment_anticipo: paymentAdvance ? 1 : 0,
                oc_delivery_place: cleanDeliveryPlace || null,
                oc_delivery_date: cleanDeliveryDate || null,
                oc_payment_start_date: cleanPaymentStartDate || null,
                oc_payment_end_date: cleanPaymentEndDate || null,
                oc_payment_date: cleanPaymentDate || null,
                oc_installments_count: cleanInstallmentsCount || null,
                oc_advance_percentage: cleanAdvancePercentage || null,
                oc_payment_compliance: paymentCompliance ? 1 : 0,
              }),
            });
        const metaData = await metaResp.json().catch(() => ({}));
        if (!metaResp.ok) throw new Error(metaData?.message || "Error al guardar número de orden");
        const assignedFolio = String(metaData?.folio || providerExistingFolio || "").trim();
        if (assignedFolio) foliosAssigned.add(assignedFolio);
        setMetaByProvider((prev) => ({
          ...prev,
          [provider.id]: {
            ...(prev[provider.id] || {}),
            folio: assignedFolio,
            oc_payment_mode: paymentMode,
            oc_payment_anticipo: paymentAdvance,
            oc_delivery_place: cleanDeliveryPlace,
            oc_delivery_date: cleanDeliveryDate,
            oc_payment_start_date: cleanPaymentStartDate,
            oc_payment_end_date: cleanPaymentEndDate,
            oc_payment_date: cleanPaymentDate,
            oc_installments_count: cleanInstallmentsCount,
            oc_advance_percentage: cleanAdvancePercentage,
            oc_payment_compliance: paymentCompliance,
          },
        }));
      }
      setOrderNumber(foliosAssigned.size ? Array.from(foliosAssigned).join(", ") : "");

      toast.success("Formato de orden guardado");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo guardar el formato");
    } finally {
      setSavingOrderSetup(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (downloadingExcel) return;
    try {
      setDownloadingExcel(true);
      const resp = await fetch(`${API_URL}/cotizacion/${id}/excel`, {
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo generar el Excel");
      }

      const blob = await resp.blob();
      const disposition = resp.headers.get("content-disposition") || "";
      const match =
        disposition.match(/filename\*=UTF-8''([^;]+)/i) ||
        disposition.match(/filename="?([^"]+)"?/i);
      const filename = decodeURIComponent(
        (match?.[1] || `Cotizacion_${id}.xlsx`).replace(/["']/g, "")
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo generar el Excel");
    } finally {
      setDownloadingExcel(false);
    }
  };

  const openExcelPreviewPage = () => {
    const next = new URLSearchParams(searchParams);
    next.set("vista", "excel");
    setSearchParams(next);
  };

  const closeExcelPreviewPage = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("vista");
    setSearchParams(next);
  };

  if (loading) {
    return <div className="p-10 text-center text-sm text-gray-500">Cargando orden...</div>;
  }

  if (isExcelPreviewMode) {
    return (
      <div className="p-3 sm:p-5 lg:p-6 bg-[#F3F4F6] min-h-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={closeExcelPreviewPage}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              ← Volver a proceso
            </button>
            <h1 className="text-lg font-bold text-gray-800">Vista previa de Excel #{id}</h1>
          </div>
          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
              downloadingExcel
                ? "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {downloadingExcel ? "GENERANDO..." : "DESCARGAR EXCEL"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="text-sm font-semibold text-gray-800">Previsualización del contenido</div>
            <div className="text-xs text-gray-500">Revisa datos antes de descargar e imprimir.</div>
          </div>
          <div className="overflow-auto max-h-[75vh]">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No hay partidas para previsualizar.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-600 uppercase tracking-wide border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-right">P. Unitario</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 text-right">IVA</th>
                    <th className="px-3 py-2 text-right">ISR</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-700">
                        {item.product_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {item.description || item.selected_description || "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-700">{item.quantity || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">{item.provider_name || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{money(item.selected_unit_price)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{money(item.subtotal)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {item.vatPct ? `${item.vatPct}% (${money(item.vatAmount)})` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {item.isrPct ? `${item.isrPct}% (${money(item.isrAmount)})` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-3 py-2 font-bold text-gray-800" colSpan={8}>
                      Total general
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{money(totalGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] min-h-full">
      <ConfirmModal
        open={confirmOpen}
        title="Marcar como finalizada"
        headerText="Confirmar compra"
        description="Esta acción moverá la requisición a historial como finalizada. ¿Deseas continuar?"
        confirmText="Sí, marcar"
        cancelText="Cancelar"
        loading={saving}
        onConfirm={handleMarkCompleted}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 bg-white text-gray-600 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Regresar"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800">Proceso de compra #{id}</h1>
              <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded-full uppercase bg-blue-50 text-blue-700 border border-blue-100">
                Estatus {isFinalized ? 11 : 13}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {requisitionUnitLabel}
              <span className="mx-2 text-gray-400">•</span>
              {requisition?.coordinacion || "General"}
              <span className="mx-2 text-gray-400">•</span>
              {requisition?.created_at
                ? new Date(requisition.created_at).toLocaleDateString("es-MX")
                : "—"}
            </p>
            {summary.last_selection_at && (
              <p className="text-[11px] text-gray-500 mt-1">
                Última selección:{" "}
                {new Date(summary.last_selection_at).toLocaleString("es-MX")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
            title="Cuadro comparativo y Excel"
          >
            <button
              onClick={() => navigate(`/compras/cotizar/${id}`)}
              className="px-3 py-2 text-[11px] font-semibold flex items-center gap-1.5 text-gray-700 hover:bg-white transition-colors"
            >
              <FileText size={12} />
              VER COMPARATIVO
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <button
              onClick={openExcelPreviewPage}
              className="px-3 py-2 text-[11px] font-semibold text-gray-700 hover:bg-white transition-colors"
            >
              EXCEL
            </button>
          </div>
          {!isReader && !isFinalized && (
            <button
              onClick={handleRequestFinalize}
              disabled={!summary.is_complete}
              className={`px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
                summary.is_complete
                  ? "bg-[#8B1D35] hover:bg-[#72182b] text-white border-[#8B1D35]"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
              }`}
              title={summary.is_complete ? "Marcar como finalizada" : "Faltan partidas por seleccionar"}
            >
              <CheckCircle2 size={12} />
              Marcar finalizada
            </button>
          )}
        </div>
      </div>
      </div>

      {isReader && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 shadow-sm">
          Vista de consulta. Los pasos finales del proceso de compra solo los puede ejecutar Jefatura de Compras.
        </div>
      )}
      {isFinalized && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-800 shadow-sm">
          Esta requisición ya está finalizada. El formulario se muestra en modo solo lectura.
        </div>
      )}

      {!summary.is_complete && summary.total_items > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 shadow-sm">
          Faltan {summary.missing_items} partida(s) por seleccionar. No se puede
          marcar como finalizada hasta completar la selección.
        </div>
      )}

      {providersWithMissingData.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
            Validación previa de formato
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Hay datos de proveedor incompletos. Completa primero para que la orden salga correcta.
          </p>
          <div className="mt-2 space-y-1 text-xs text-amber-900">
            {providersWithMissingData.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <div>
                  <span className="font-bold">{p.name}:</span> falta {p.missing.join(", ")}
                </div>
                {isAdmin && (
                  <button
                    onClick={() =>
                      navigate(`/compras/proveedores?editProviderId=${encodeURIComponent(String(p.id))}`)
                    }
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-amber-300 text-amber-800 bg-white hover:bg-amber-100"
                  >
                    Editar este proveedor
                  </button>
                )}
              </div>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={() =>
                firstProviderMissingDataId
                  ? navigate(
                      `/compras/proveedores?editProviderId=${encodeURIComponent(
                        String(firstProviderMissingDataId)
                      )}`
                    )
                  : navigate("/compras/proveedores")
              }
              className="mt-3 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-amber-300 text-amber-800 bg-white hover:bg-amber-100"
            >
              Corregir datos de proveedor
            </button>
          )}
        </div>
      )}

      <div className="mb-4 bg-white rounded-2xl border border-[#8B1D35]/15 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-[#8B1D35] uppercase">
              Descarga de orden
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Genera PDF por proveedor sin saturar la vista.
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
            {providersList.length} proveedor{providersList.length === 1 ? "" : "es"}
          </span>
        </div>
        {providersList.length <= 1 ? (
          <button
            onClick={() => handleDownloadPdf(providersList[0]?.id)}
            disabled={downloading}
            className={`px-3 py-2 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
              downloading
                ? "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
                : "bg-[#8B1D35] text-white border-[#8B1D35] hover:bg-[#72182b]"
            }`}
            title="Descargar orden"
          >
            <FileText size={12} />
            {downloading ? "GENERANDO..." : orderType === "servicio" ? "ORDEN DE SERVICIO" : "ORDEN DE COMPRA"}
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">
              Seleccionar proveedor
            </span>
            <select
              value={downloadProviderId}
              onChange={(e) => setDownloadProviderId(e.target.value)}
              className="min-w-[240px] max-w-[360px] px-3 py-2 rounded-md text-[11px] font-semibold border border-gray-300 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-[#8B1D35] focus:border-[#8B1D35]"
            >
              {providersList.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleDownloadPdf(downloadProviderId)}
              disabled={downloading || !downloadProviderId}
              className={`px-3 py-2 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
                downloading || !downloadProviderId
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
                  : "bg-[#8B1D35] text-white border-[#8B1D35] hover:bg-[#72182b]"
              }`}
              title="Descargar orden del proveedor seleccionado"
            >
              <FileText size={12} />
              {downloading ? "GENERANDO..." : "DESCARGAR ORDEN"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
            <FileText size={16} className="text-[#8B1D35]" />
            Detalle de la requisición
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center">
                  <Building2 size={13} />
                </span>
                Unidad
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {requisitionUnitLabel}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center">
                  <MapPin size={13} />
                </span>
                Coordinación
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900 leading-snug">
                {requisition?.coordinacion || "General"}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 md:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center">
                  <Briefcase size={13} />
                </span>
                Proyecto / Asunto
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900 leading-snug">
                {requisition?.request_name || "—"}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 md:col-span-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                <span className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center">
                  <FileText size={13} />
                </span>
                Justificación
              </div>
              <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                {requisition?.justification || requisition?.observation || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="text-xs font-bold text-gray-500 uppercase">Total general</div>
          <div className="text-2xl font-extrabold text-[#8B1D35] mt-1">{money(totalGeneral)}</div>
          <div className="mt-3 text-[11px] text-gray-500">Total con IVA/ISR de selección</div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Totales por proveedor</div>
            <div className="space-y-2 text-xs">
              {totalsByProvider.map((p) => (
                <div key={p.name} className="flex justify-between rounded-lg bg-gray-50 px-2 py-1.5">
                  <span className="text-gray-600 truncate max-w-[70%]">{p.name}</span>
                  <span className="font-semibold text-gray-900">{money(p.total)}</span>
                </div>
              ))}
              {totalsByProvider.length === 0 && (
                <div className="text-gray-400">Sin datos</div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-3">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
            <FileText size={16} className="text-[#8B1D35]" />
            Formato de orden
          </h2>
          <div className="mb-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#fff3ef] border border-[#8B1D35]/25 text-[#8B1D35] font-semibold">
              Campos editables
            </span>
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-600 font-semibold">
              Campos bloqueados
            </span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Requisición</div>
                <div className="mt-1 font-semibold text-gray-800">#{id}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Proveedores seleccionados</div>
                <div className="mt-1 font-semibold text-gray-800">{providersList.length}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Unidad</div>
                <div className="mt-1 font-semibold text-gray-800 truncate">{requisitionUnitLabel}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Total estimado</div>
                <div className="mt-1 font-semibold text-gray-800">{money(totalGeneral)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                Captura del formato
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                <div className="xl:col-span-3 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de formato</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                    disabled={!canEditOrderSetup}
                  >
                    <option value="compra">Orden de compra</option>
                    <option value="servicio">Orden de servicio</option>
                  </select>
                </div>

                <div className="xl:col-span-5 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">
                    Número de orden recibido
                  </label>
                  <input
                    value={orderNumber}
                    readOnly
                    className={blockedInputClass}
                    placeholder="Se genera en consecutivo automático por proveedor"
                    disabled
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Consecutivo automático por proveedor.
                  </p>
                  {autoAssigningFolios && (
                    <p className="mt-1 text-[11px] text-blue-700">Asignando folios automáticos...</p>
                  )}
                </div>

                <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha de entrega</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                    disabled={!canEditOrderSetup}
                  />
                </div>

                {orderType === "servicio" && (
                  <>
                    <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha de inicio</label>
                      <input
                        type="date"
                        value={paymentStartDate}
                        onChange={(e) => setPaymentStartDate(e.target.value)}
                        className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                        disabled={!canEditOrderSetup}
                      />
                    </div>
                    <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha de conclusión</label>
                      <input
                        type="date"
                        value={paymentEndDate}
                        onChange={(e) => setPaymentEndDate(e.target.value)}
                        className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                        disabled={!canEditOrderSetup}
                      />
                    </div>
                    <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha de pago</label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                        disabled={!canEditOrderSetup}
                      />
                    </div>
                  </>
                )}

                <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Condiciones de pago</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                    disabled={!canEditOrderSetup}
                  >
                    <option value="contado">Pago de contado</option>
                    <option value="parcialidades">Pago en parcialidades</option>
                  </select>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={paymentAdvance}
                        onChange={(e) => setPaymentAdvance(e.target.checked)}
                        disabled={!canEditOrderSetup}
                        className="h-4 w-4 rounded border-gray-300 text-[#8B1D35] focus:ring-[#8B1D35]"
                      />
                      Incluir anticipo (a)
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={paymentCompliance}
                        onChange={(e) => setPaymentCompliance(e.target.checked)}
                        disabled={!canEditOrderSetup}
                        className="h-4 w-4 rounded border-gray-300 text-[#8B1D35] focus:ring-[#8B1D35]"
                      />
                      Incluir cumplimiento (b)
                    </label>
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Parcialidades y anticipo</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                        No. parcialidades
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(e.target.value)}
                        placeholder="Ej. 3"
                        className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                        disabled={!canEditOrderSetup}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase">
                        % anticipo
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={advancePercentage}
                        onChange={(e) => setAdvancePercentage(e.target.value)}
                        placeholder="Ej. 30"
                        className={canEditOrderSetup ? editableInputClass : blockedInputClass}
                        disabled={!canEditOrderSetup}
                      />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-lg border border-gray-200 bg-white p-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Lugar de entrega</label>
                  <textarea
                    value={deliveryPlace}
                    onChange={(e) => setDeliveryPlace(e.target.value)}
                    className={`${canEditOrderSetup ? editableInputClass : blockedInputClass} resize-none`}
                    rows={3}
                    placeholder={DEFAULT_DELIVERY_PLACE}
                    disabled={!canEditOrderSetup}
                  />
                  <p className="mt-1 text-[11px] text-gray-500">Por default usa {DEFAULT_DELIVERY_PLACE}.</p>
                </div>
              </div>
            </div>

            {canEditOrderSetup && (
              <button
                onClick={handleSaveOrderSetup}
                disabled={savingOrderSetup || providersList.length === 0}
                className={`w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                  savingOrderSetup || providersList.length === 0
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-[#8B1D35] text-white hover:bg-[#72182b]"
                }`}
              >
                {savingOrderSetup ? "GUARDANDO FORMATO..." : "GUARDAR FORMATO DE ORDEN"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
          <FileText size={16} className="text-[#8B1D35]" />
          Previsualización de orden
        </h2>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500">
            Datos del proveedor en tiempo real para validar antes de finalizar.
          </p>
          <button
            onClick={async () => {
              if (isAdmin && firstProviderMissingDataId) {
                navigate(
                  `/compras/proveedores?editProviderId=${encodeURIComponent(
                    String(firstProviderMissingDataId)
                  )}`
                );
                return;
              }
              try {
                setRefreshingPreview(true);
                await loadData();
              } finally {
                setRefreshingPreview(false);
              }
            }}
            disabled={refreshingPreview && !(isAdmin && firstProviderMissingDataId)}
            className={`px-3 py-2 rounded-md text-[11px] font-semibold border transition-colors ${
              refreshingPreview && !(isAdmin && firstProviderMissingDataId)
                ? "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {isAdmin && firstProviderMissingDataId
              ? "ACTUALIZAR DATOS DE PROVEEDOR"
              : refreshingPreview
              ? "ACTUALIZANDO..."
              : "ACTUALIZAR DATOS"}
          </button>
        </div>
        {providersList.length === 0 ? (
          <div className="text-xs text-gray-500">Sin proveedor seleccionado.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {providersList.map((provider) => {
              const info = providerInfoMap.get(Number(provider.id)) || {};
              const meta = metaByProvider[provider.id] || {};
              const folioValue = String(meta.folio || "").trim();
              const deliveryDateValue = String(meta.oc_delivery_date || "").trim();
              const checks = {
                folio: Boolean(folioValue),
                razonSocial: Boolean(String(info.razon_social || "").trim()),
                rfc: Boolean(String(info.rfc || "").trim()),
                phone: Boolean(String(info.phones || "").trim()),
                address: Boolean(String(info.address || "").trim()),
              };
              const isComplete = Object.values(checks).every(Boolean);
              const missingFields = [];
              if (!checks.folio) missingFields.push("Folio");
              if (!checks.razonSocial) missingFields.push("Razón social");
              if (!checks.rfc) missingFields.push("RFC");
              if (!checks.phone) missingFields.push("Teléfono");
              if (!checks.address) missingFields.push("Dirección");
              return (
                <div key={provider.id} className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-gray-800">{info.name || provider.name || "—"}</div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isComplete ? "Completo" : "Pendiente"}
                    </span>
                  </div>
                  {!isComplete && (
                    <div className="mt-1 text-[10px] text-amber-700">
                      Falta: {missingFields.join(", ")}
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Número de orden</div>
                      <div className="mt-1 text-gray-800">{folioValue || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Tipo</div>
                      <div className="mt-1 text-gray-800">
                        {orderType === "servicio" ? "Orden de servicio" : "Orden de compra"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Razón social</div>
                      <div className="mt-1 text-gray-800">{info.razon_social || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">RFC</div>
                      <div className="mt-1 text-gray-800">{info.rfc || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Teléfono</div>
                      <div className="mt-1 text-gray-800">{info.phones || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2 md:col-span-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Dirección</div>
                      <div className="mt-1 text-gray-800">{info.address || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Condición de pago</div>
                      <div className="mt-1 text-gray-800">
                        {paymentMode === "parcialidades" ? "Parcialidades" : "Contado"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Parcialidades / Anticipo</div>
                      <div className="mt-1 text-gray-800">
                        {installmentsCount || "—"} /{" "}
                        {advancePercentage ? `${advancePercentage}%` : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-2 md:col-span-2">
                      <div className="text-[10px] font-bold uppercase text-gray-500">Fecha de entrega</div>
                      <div className="mt-1 text-gray-800">{deliveryDateValue || "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-white to-gray-50">
          <FileText size={16} className="text-[#8B1D35]" />
          <h3 className="font-bold text-gray-800 text-sm">Selección por partida</h3>
          <span className="ml-auto text-xs text-gray-400">{rows.length} partida(s)</span>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 text-xs">
              <tr>
                <th className="px-4 py-2 w-16 text-center">Cant.</th>
                <th className="px-4 py-2 w-52">Producto</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2 w-28 text-right">Unidad</th>
                <th className="px-4 py-2">Proveedor</th>
                <th className="px-4 py-2 w-28 text-right">P. Unitario</th>
                <th className="px-4 py-2 w-28 text-right">Sub Total</th>
                <th className="px-4 py-2 w-36 text-right">Impuestos</th>
                <th className="px-4 py-2 w-28 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-gray-400">
                    No hay partidas registradas
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="hover:bg-[#8B1D35]/[0.03] transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-semibold text-gray-900">
                        {item.product_name || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-semibold text-gray-900">
                        {item.description || "—"}
                      </div>
                      {item.selected_description && item.selected_description !== item.description && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          {item.selected_description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 uppercase">
                      {item.unidad_medida || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.provider_name ? (
                        item.provider_name
                      ) : (
                        <span className="text-amber-700 font-semibold">Sin proveedor</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      <div className="font-medium">{money(item.selected_unit_price)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {money(item.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-gray-700">
                      {item.vatPct > 0 || item.isrPct > 0 ? (
                        <div className="space-y-1">
                          {item.vatPct > 0 && (
                            <div>
                              <span className="font-semibold text-sky-700">IVA {item.vatPct}%:</span>{" "}
                              <span>{money(item.vatAmount)}</span>
                            </div>
                          )}
                          {item.isrPct > 0 && (
                            <div>
                              <span className="font-semibold text-slate-700">ISR {item.isrPct}%:</span>{" "}
                              <span>-{money(item.isrAmount)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {money(item.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {summary.total_items > 0 && summary.selected_items === 0 && (
        <div className="mt-4 text-xs text-gray-500">
          Aún no hay selección registrada por el solicitante.
        </div>
      )}
    </div>
  );
}
