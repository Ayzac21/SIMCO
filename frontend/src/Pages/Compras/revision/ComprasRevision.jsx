import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info, Save } from "lucide-react";
import { toast } from "sonner";
import useEscapeKey from "../../../hooks/useEscapeKey";
import { API_BASE_URL } from "../../../api/config";

const API_URL = `${API_BASE_URL}/compras`;

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

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

function ConfirmModal({
  open,
  title = "Confirmar selección",
  description,
  confirmText = "Sí, guardar selección",
  cancelText = "Revisar",
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEscapeKey(
    open,
    () => {
      if (!loading) onCancel?.();
    },
    loading
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onCancel} />
      <div className="relative w-[92%] max-w-md bg-white rounded-2xl shadow-xl border border-[#8B1D35]/20 overflow-hidden">
        <div className="px-5 py-4 bg-[#8B1D35]">
          <div className="text-white font-bold text-sm">{title}</div>
          <div className="text-white/80 text-xs mt-1">Revisión final de Compras</div>
        </div>
        <div className="p-5">
          <div className="text-sm text-gray-800 leading-relaxed">{description}</div>
          <div className="mt-5 flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#8B1D35] hover:bg-[#72182b] text-white disabled:opacity-60"
            >
              {loading ? "GUARDANDO..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CuadroComparativo({
  items,
  providers,
  priceMap,
  selectedByItem,
  setSelectedByItem,
  canEdit = true,
}) {
  const cols = useMemo(() => {
    return (providers || []).filter((p) => {
      if (p.status === "responded") return true;
      return items.some((it) => {
        const row = priceMap[`${it.id}_${p.id}`];
        const hasPrice = row?.unit_price != null && row?.unit_price !== "";
        const hasDesc = (row?.offered_description || "").trim().length > 0;
        return hasPrice || hasDesc;
      });
    });
  }, [providers, items, priceMap]);

  const cheapestByItem = useMemo(() => {
    const out = {};
    for (const it of items) {
      let bestProv = null;
      let bestPrice = Number.POSITIVE_INFINITY;
      for (const p of cols) {
        const row = priceMap[`${it.id}_${p.id}`];
        if (row?.unit_price == null || row?.unit_price === "") continue;
        const n = Number(row.unit_price);
        if (!Number.isFinite(n)) continue;
        if (n < bestPrice) {
          bestPrice = n;
          bestProv = p.id;
        }
      }
      out[it.id] = bestProv;
    }
    return out;
  }, [items, cols, priceMap]);

  if (!items?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 text-center">
        No hay partidas para revisar.
      </div>
    );
  }
  if (!cols.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600 text-center">
        No hay proveedores con respuesta aún.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-800">Cuadro comparativo interno</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Revisión final por Compras Admin
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200">
          {cols.length} proveedor(es)
        </span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 min-w-[340px] sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                Partida
              </th>
              {cols.map((p) => (
                <th key={p.id} className="text-left px-4 py-3 min-w-[260px] border-r border-gray-100">
                  <div className="font-extrabold text-gray-700 truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-400 normal-case truncate">Precio + descripción</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it) => {
              const selectedProv = Number(selectedByItem[it.id] || 0) || null;
              const cheapestProv = cheapestByItem[it.id];
              return (
                <tr key={it.id} className="align-top">
                  <td className="px-4 py-4 sticky left-0 z-10 bg-white border-r border-gray-200">
                    <div className="font-bold text-gray-800">{it.description || "—"}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Cantidad: {it.quantity} {it.unidad_medida ? `(${it.unidad_medida})` : ""}
                    </div>
                  </td>
                  {cols.map((p) => {
                    const k = `${it.id}_${p.id}`;
                    const row = priceMap[k] || {};
                    const desc = (row?.offered_description || "").trim();
                    const hasPrice = row?.unit_price != null && row?.unit_price !== "";
                    const hasSomething = hasPrice || desc.length > 0;
                    const isSelected = selectedProv === p.id;
                    const isCheapest = cheapestProv === p.id;
                    return (
                      <td key={p.id} className="px-4 py-4 border-r border-gray-100">
                        {!hasSomething ? (
                          <div className="text-xs text-gray-400">Sin respuesta</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!canEdit) return;
                              setSelectedByItem((prev) => ({ ...prev, [it.id]: p.id }));
                            }}
                            disabled={!canEdit}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? "border-[#8B1D35] bg-[#8B1D35]/5"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            } ${!canEdit ? "opacity-80 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <span className="text-[11px] font-bold text-gray-500">
                                    {isSelected ? "Seleccionado" : "Seleccionar"}
                                  </span>
                                  {isCheapest && (
                                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8B1D35]/10 text-[#8B1D35] border border-[#8B1D35]/20 whitespace-nowrap">
                                      Más barata
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                  {desc ? desc : "Sin detalle del proveedor"}
                                </div>
                              </div>
                              <div className="font-extrabold text-gray-900 whitespace-nowrap sm:text-right">
                                {money(row?.unit_price)}
                              </div>
                            </div>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComprasRevision() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [requisition, setRequisition] = useState(null);
  const [items, setItems] = useState([]);
  const [invitedProviders, setInvitedProviders] = useState([]);
  const [savedPrices, setSavedPrices] = useState([]);
  const [selectedByItem, setSelectedByItem] = useState({});
  const [canEdit, setCanEdit] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_URL}/revision/${id}/data`, { headers: getAuthHeaders() });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error cargando revisión");

      if (data?.canEdit === false) {
        toast.info("Esta requisición ya está en proceso de compra. Redirigiendo...");
        navigate(`/compras/orden/${id}`, { replace: true });
        return;
      }

      setRequisition(data.requisition || null);
      setItems(Array.isArray(data.items) ? data.items : []);
      setInvitedProviders(Array.isArray(data.invitedProviders) ? data.invitedProviders : []);
      setSavedPrices(Array.isArray(data.savedPrices) ? data.savedPrices : []);
      setCanEdit(Boolean(data?.canEdit));

      const pre = {};
      if (Array.isArray(data.selections)) {
        data.selections.forEach((s) => {
          if (s?.line_item_id && s?.provider_id) pre[s.line_item_id] = s.provider_id;
        });
      }
      setSelectedByItem(pre);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo cargar la revisión interna");
      navigate("/compras/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const priceMap = useMemo(() => {
    const m = {};
    savedPrices.forEach((p) => {
      m[`${p.line_item_id}_${p.provider_id}`] = {
        unit_price: p.unit_price,
        offered_description: p.offered_description,
      };
    });
    return m;
  }, [savedPrices]);

  const selectedCount = useMemo(
    () => items.reduce((acc, it) => acc + (selectedByItem[it.id] ? 1 : 0), 0),
    [items, selectedByItem]
  );

  const canSave = useMemo(() => {
    if (!items.length) return false;
    return items.every((it) => Boolean(selectedByItem[it.id]));
  }, [items, selectedByItem]);

  const buildSelectionsPayload = () =>
    items.map((it) => {
      const provider_id = Number(selectedByItem[it.id]);
      const k = `${it.id}_${provider_id}`;
      const row = priceMap[k] || {};
      return {
        line_item_id: it.id,
        provider_id,
        selected_unit_price: row.unit_price ?? null,
        selected_description: row.offered_description ?? "",
      };
    });

  const handleSaveSelection = async () => {
    if (!canEdit || saving || !canSave) return;
    try {
      setConfirmOpen(false);
      setSaving(true);
      const selections = buildSelectionsPayload();
      const resp = await fetch(`${API_URL}/revision/${id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ selections }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error guardando selección");

      toast.success(data?.message || "Selección guardada");
      navigate("/compras/dashboard");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleBackToCotizacion = async () => {
    if (!canEdit || reopening || saving) return;
    try {
      setReopening(true);
      const resp = await fetch(`${API_URL}/cotizacion/${id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "No se pudo regresar a cotización");
      toast.success(data?.message || "Regresada a cotización");
      navigate(`/compras/cotizar/${id}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo regresar a cotización");
    } finally {
      setReopening(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm text-gray-500">Cargando revisión interna...</div>;
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 bg-[#F3F4F6] min-h-full">
      <ConfirmModal
        open={confirmOpen}
        loading={saving}
        title="Confirmar selección final"
        description="Al confirmar, la selección quedará registrada por Compras Admin y la requisición pasará a proceso de compra."
        confirmText="Sí, confirmar selección"
        cancelText="Revisar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSaveSelection}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white text-gray-600 rounded-full shadow-sm border border-gray-200 hover:bg-gray-50"
            title="Regresar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">Revisión interna #{id}</h1>
              <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded-full bg-[#8B1D35]/10 text-[#8B1D35] uppercase">
                Compras Admin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Categoría:{" "}
              <span className="font-semibold text-[#8B1D35] bg-[#8B1D35]/10 px-1.5 rounded">
                {requisition?.category_name || "—"}
              </span>
              <span className="ml-2 text-gray-400">•</span>
              <span className="ml-2 font-semibold text-gray-700">
                {selectedCount}/{items.length} seleccionadas
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToCotizacion}
            disabled={!canEdit || reopening || saving}
            className={`px-4 py-2 rounded-lg text-xs font-bold border border-amber-200 text-amber-700 flex items-center gap-2 transition-colors ${
              !canEdit || reopening || saving ? "opacity-60 cursor-not-allowed" : "hover:bg-amber-50"
            }`}
            title="Regresar a cotización para agregar o ajustar proveedores"
          >
            <ArrowLeft size={14} />
            {reopening ? "REGRESANDO..." : "REGRESAR A COTIZACIÓN"}
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canEdit || !canSave || saving || reopening}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors ${
              !canEdit || !canSave || saving || reopening
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-[#8B1D35] hover:bg-[#72182b] text-white"
            }`}
          >
            <Save size={14} />
            {saving ? "GUARDANDO..." : "CONFIRMAR SELECCIÓN"}
          </button>
        </div>
      </div>

      <div className="mb-4 bg-[#8B1D35]/5 border border-[#8B1D35]/10 rounded-xl p-4 flex gap-3">
        <div className="mt-0.5 text-[#8B1D35]">
          <Info size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">
            {canEdit ? "Selección final de proveedores" : "Resumen de selección final"}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
            {canEdit
              ? "Este cuadro comparativo es interno de Compras. Selecciona un proveedor por partida y confirma para pasar a proceso de compra."
              : "La requisición ya avanzó a proceso de compra. Puedes consultar la selección guardada en modo lectura."}
          </p>
        </div>
      </div>

      <CuadroComparativo
        items={items}
        providers={invitedProviders}
        priceMap={priceMap}
        selectedByItem={selectedByItem}
        setSelectedByItem={setSelectedByItem}
        canEdit={canEdit}
      />
    </div>
  );
}
