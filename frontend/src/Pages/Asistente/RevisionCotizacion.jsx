import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Save } from "lucide-react";
import { toast } from "sonner";

const API = "http://localhost:4000/api";

/** ✅ Modal inline (sin archivo extra) */
function ConfirmModal({
  open,
  title = "Confirmar selección",
  description,
  confirmText = "Sí, enviar a Compras",
  cancelText = "Revisar",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onCancel}
      />

      <div className="relative w-[92%] max-w-md bg-white rounded-2xl shadow-xl border border-[#8B1D35]/20 overflow-hidden">
        <div className="px-5 py-4 bg-[#8B1D35]">
          <div className="text-white font-bold text-sm">{title}</div>
          <div className="text-white/80 text-xs mt-1">
            Revisa antes de continuar
          </div>
        </div>

        <div className="p-5">
          <div className="text-sm text-gray-800 leading-relaxed">
            {description}
          </div>

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
              {loading ? "ENVIANDO..." : confirmText}
            </button>
          </div>

          <div className="mt-3 text-[11px] text-gray-500">
            * Al confirmar, tu selección quedará registrada.
          </div>
        </div>
      </div>
    </div>
  );
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
}

/**
 * Cuadro comparativo:
 * - filas: partidas
 * - columnas: proveedores
 * - click en celda => selecciona proveedor por partida
 */
function CuadroComparativo({
  items,
  providers,
  priceMap,
  selectedByItem,
  setSelectedByItem,
  isReviewOpen,
}) {
  const cols = useMemo(() => {
    return (providers || []).filter((p) => {
      if (p.status === "responded") return true;
      // si hay precio/desc guardado, mostrar aunque el status no sea responded
      return items.some((it) => {
        const row = priceMap[`${it.id}_${p.id}`];
        const hasPrice = row?.unit_price != null && row?.unit_price !== "";
        const hasDesc = (row?.offered_description || "").trim().length > 0;
        return hasPrice || hasDesc;
      });
    });
  }, [providers, items, priceMap]);

  // más barata por partida (solo si existe precio)
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
        No hay proveedores con respuesta aún. Cuando exista al menos una
        cotización, aparecerán aquí para seleccionar.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-800">
            Cuadro comparativo
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Partidas en filas • Proveedores en columnas • Selecciona 1 por partida
          </div>
        </div>

        <span className="text-[11px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200">
          {cols.length} proveedor(es)
        </span>
      </div>

      {/* Tabla con scroll */}
      <div className="overflow-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0 z-10">
            <tr>
              {/* Partida sticky */}
              <th className="text-left px-4 py-3 min-w-[340px] sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                Partida
              </th>

              {cols.map((p) => (
                <th
                  key={p.id}
                  className="text-left px-4 py-3 min-w-[260px] border-r border-gray-100"
                >
                  <div className="font-extrabold text-gray-700 truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-gray-400 normal-case truncate">
                    Precio + descripción
                  </div>
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
                  {/* Partida sticky */}
                  <td className="px-4 py-4 sticky left-0 z-10 bg-white border-r border-gray-200">
                    <div className="font-bold text-gray-800">
                      {it.description || "—"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Cantidad: {it.quantity}{" "}
                      {it.unidad_medida ? `(${it.unidad_medida})` : ""}
                    </div>

                    <div className="mt-2">
                      {selectedProv ? (
                        <span className="text-[11px] font-bold px-2 py-1 rounded bg-secundario/10 text-secundario border border-secundario/20">
                          Seleccionado
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
                          Falta elegir
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Proveedores */}
                  {cols.map((p) => {
                    const k = `${it.id}_${p.id}`;
                    const row = priceMap[k] || {};
                    const desc = (row?.offered_description || "").trim();
                    const hasPrice =
                      row?.unit_price != null && row?.unit_price !== "";
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
                            disabled={!isReviewOpen}
                            onClick={() => {
                              if (!isReviewOpen) return;
                              setSelectedByItem((prev) => ({ ...prev, [it.id]: p.id }));
                            }}
                            className={`w-full text-left rounded-lg border p-3 transition
                              ${!isReviewOpen ? "cursor-not-allowed opacity-70" : "hover:bg-gray-50"}
                              ${isSelected ? "border-[#8B1D35] bg-[#8B1D35]/5" : "border-gray-200 bg-white"}
                            `}
                            title={!isReviewOpen ? "No editable" : "Clic para seleccionar"}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-gray-500">
                                    {isSelected ? "✅ Seleccionado" : "Seleccionar"}
                                  </span>

                                  {isCheapest && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secundario/10 text-secundario border border-secundario/20">
                                      Más barata
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                  {desc ? desc : "Sin descripción"}
                                </div>
                              </div>

                              <div className="font-extrabold text-gray-900 whitespace-nowrap">
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

      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
        Tip: si hay muchos proveedores, usa el scroll horizontal; la columna “Partida” se queda fija.
      </div>
    </div>
  );
}

export default function RevisionCotizacion() {
  const { id } = useParams(); // requisition_id
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [requisition, setRequisition] = useState(null);
  const [items, setItems] = useState([]);
  const [invitedProviders, setInvitedProviders] = useState([]);
  const [savedPrices, setSavedPrices] = useState([]);

  // selección por partida: { [line_item_id]: provider_id }
  const [selectedByItem, setSelectedByItem] = useState({});

  // ✅ modal confirmación
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ Si el back manda canEdit, úsalo; si no existe, cae a statuses_id === 14
  const isReviewOpen = useMemo(() => {
    if (requisition?.canEdit != null) return Boolean(requisition.canEdit);
    return Number(requisition?.statuses_id) === 14;
  }, [requisition]);

  const loadData = async () => {
    try {
      setLoading(true);

      // ✅ endpoint correcto
      const resp = await fetch(`${API}/requisiciones/revision/${id}/data`);
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) throw new Error(data?.message || "Error cargando revisión");

      setRequisition(data.requisition || null);
      setItems(Array.isArray(data.items) ? data.items : []);
      setInvitedProviders(
        Array.isArray(data.invitedProviders) ? data.invitedProviders : []
      );
      setSavedPrices(Array.isArray(data.savedPrices) ? data.savedPrices : []);

      // ✅ Precarga selecciones guardadas
      if (Array.isArray(data.selections)) {
        const pre = {};
        data.selections.forEach((s) => {
          if (s?.line_item_id && s?.provider_id) pre[s.line_item_id] = s.provider_id;
        });
        setSelectedByItem(pre);
      } else {
        setSelectedByItem({});
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la revisión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // mapa rápido precio/desc
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

  const selectedCount = useMemo(() => {
    return items.reduce((acc, it) => acc + (selectedByItem[it.id] ? 1 : 0), 0);
  }, [items, selectedByItem]);

  const canSave = useMemo(() => {
    if (!items.length) return false;
    return items.every((it) => Boolean(selectedByItem[it.id]));
  }, [items, selectedByItem]);

  const buildSelectionsPayload = () => {
    return items.map((it) => {
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
  };

  /** ✅ Abre modal */
  const confirmAndSave = () => {
    if (!isReviewOpen) {
      toast.warning("No editable");
      return;
    }

    if (!canSave) {
      toast.warning("Falta selección");
      return;
    }

    setConfirmOpen(true);
  };

  const handleSaveSelection = async () => {
    if (saving) return;

    try {
      setConfirmOpen(false);
      setSaving(true);

      const selections = buildSelectionsPayload();

      // ✅ endpoint correcto
      const resp = await fetch(`${API}/requisiciones/revision/${id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error guardando selección");

      if (data?.sent_to_purchase) {
        toast.success("Selección completa");
      } else {
        toast.success("Selección guardada");
      }

      navigate("/unidad/mi-requisiciones");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-gray-500">
        Cargando revisión...
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F3F4F6] min-h-[calc(100vh-24px)]">
      <ConfirmModal
        open={confirmOpen}
        loading={saving}
        title="Confirmar selección"
        description="Al confirmar, tu selección se guardará y se enviará a Compras para que generen el pedido. ¿Deseas continuar?"
        confirmText="Sí, enviar a Compras"
        cancelText="Revisar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSaveSelection}
      />

      {/* Header */}
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
              <h1 className="text-xl font-bold text-gray-800">
                Revisión de cotización #{id}
              </h1>

              <span
                className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded-full uppercase
                  ${isReviewOpen ? "bg-[#8B1D35]/10 text-[#8B1D35]" : "bg-gray-200 text-gray-700"}
                `}
              >
                {isReviewOpen
                  ? "En revisión"
                  : `Estatus #${requisition?.statuses_id || "—"}`}
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

        <button
          onClick={confirmAndSave}
          disabled={!isReviewOpen || !canSave || saving}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-colors
            ${(!isReviewOpen || !canSave || saving)
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-[#8B1D35] hover:bg-[#72182b] text-white"}
          `}
          title={
            !isReviewOpen
              ? "No editable (no está en estatus 14)"
              : !canSave
              ? "Selecciona un proveedor para cada partida"
              : "Guardar selección"
          }
        >
          <Save size={14} />
          {saving ? "GUARDANDO..." : "GUARDAR SELECCIÓN"}
        </button>
      </div>

      {/* Mensaje */}
      <div className="mb-4 bg-[#8B1D35]/5 border border-[#8B1D35]/10 rounded-xl p-4 flex gap-3">
        <div className="mt-0.5 text-[#8B1D35]">
          <Info size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">
            Selección por partida
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
            Elige <b>un proveedor por partida</b>.{" "}
            {isReviewOpen
              ? "Al confirmar, la selección se guardará y se enviará a Compras cuando esté completa."
              : "Esta requisición ya no está en revisión, por lo que no se puede modificar."}
          </p>
        </div>
      </div>

      {/* ✅ NUEVA VISTA: CUADRO COMPARATIVO */}
      <CuadroComparativo
        items={items}
        providers={invitedProviders}
        priceMap={priceMap}
        selectedByItem={selectedByItem}
        setSelectedByItem={setSelectedByItem}
        isReviewOpen={isReviewOpen}
      />
    </div>
  );
}
