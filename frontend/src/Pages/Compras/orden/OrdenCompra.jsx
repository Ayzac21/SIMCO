import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmModal from "../../../components/ConfirmModal";
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

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
};

export default function OrdenCompra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const isReader = user?.role === "compras_lector";

  const [loading, setLoading] = useState(true);
  const [requisition, setRequisition] = useState(null);
  const [items, setItems] = useState([]);
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
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaByProvider, setMetaByProvider] = useState({});
  const [orderType, setOrderType] = useState("compra");
  const [savingType, setSavingType] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_URL}/requisiciones/${id}/seleccion`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error cargando selección");

      setRequisition(data.requisition || null);
      setItems(Array.isArray(data.items) ? data.items : []);
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
        metaData.forEach((m) => {
          map[m.provider_id] = {
            folio: m.folio || "",
            oc_incluir_iva: Number(m.oc_incluir_iva) === 1,
            oc_iva_porcentaje:
              m.oc_iva_porcentaje != null ? String(m.oc_iva_porcentaje) : "",
          };
        });
        setMetaByProvider(map);
      }
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
      return { ...it, subtotal };
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

  const totalsByProvider = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = r.provider_name || "Sin proveedor";
      const prev = map.get(key) || 0;
      map.set(key, prev + (Number(r.subtotal) || 0));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [rows]);

  const totalGeneral = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Number(r.subtotal) || 0), 0);
  }, [rows]);

  const handleMarkCompleted = async () => {
    if (saving) return;
    try {
      const missing = providersList.filter((p) => {
        const meta = metaByProvider[p.id] || {};
        return !String(meta.folio || "").trim();
      });
      if (missing.length) {
        const names = missing.map((p) => p.name || `ID ${p.id}`).join(", ");
        toast.error(`Falta folio para: ${names}`);
        return;
      }

      setSaving(true);
      const resp = await fetch(`${API_URL}/requisiciones/${id}/estatus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status_id: 11, comentarios: null }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error al actualizar estatus");

      toast.success("Orden marcada como comprada");
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

  const handleSaveType = async () => {
    if (savingType) return;
    try {
      setSavingType(true);
      const resp = await fetch(`${API_URL}/orden/${id}/type`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ order_type: orderType }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error al guardar");
      toast.success("Tipo de orden guardado");
      setOrderType(orderType);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSavingType(false);
    }
  };

  const handleSaveMeta = async (providerId) => {
    if (savingMeta) return;
    try {
      setSavingMeta(true);
      const current = metaByProvider[providerId] || {};
      const payload = {
        provider_id: providerId,
        folio: current.folio || null,
        oc_incluir_iva: current.oc_incluir_iva ? 1 : 0,
        oc_iva_porcentaje: current.oc_incluir_iva ? Number(current.oc_iva_porcentaje || 0) : null,
      };
      const resp = await fetch(`${API_URL}/orden/${id}/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Error al guardar");
      toast.success("Datos de orden guardados");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSavingMeta(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm text-gray-500">Cargando orden...</div>;
  }

  return (
    <div className="p-6 bg-[#F3F4F6] min-h-[calc(100vh-24px)]">
      <ConfirmModal
        open={confirmOpen}
        title="Marcar como comprada"
        headerText="Confirmar compra"
        description="Esta acción moverá la requisición a historial como comprada. ¿Deseas continuar?"
        confirmText="Sí, marcar"
        cancelText="Cancelar"
        loading={saving}
        onConfirm={handleMarkCompleted}
        onCancel={() => setConfirmOpen(false)}
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
              <h1 className="text-xl font-bold text-gray-800">Proceso de compra #{id}</h1>
              <span className="text-[10px] font-bold tracking-wide px-2 py-1 rounded-full uppercase bg-blue-50 text-blue-700 border border-blue-100">
                Estatus 13
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {requisition?.nombre_unidad || requisition?.ure_solicitante || "Sin unidad"}
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

        <div className="flex gap-2">
          {providersList.length <= 1 ? (
            <button
              onClick={() => handleDownloadPdf(providersList[0]?.id)}
              disabled={downloading}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm border ${
                downloading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
              title="Descargar orden"
            >
              <FileText size={14} />
              {downloading ? "GENERANDO..." : orderType === "servicio" ? "ORDEN DE SERVICIO" : "ORDEN DE COMPRA"}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-gray-500 font-semibold">Orden por proveedor</div>
              <div className="flex flex-wrap gap-2">
                {providersList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleDownloadPdf(p.id)}
                    disabled={downloading}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-2 shadow-sm border ${
                      downloading
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <FileText size={12} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!summary.is_complete || isReader}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm ${
              summary.is_complete && !isReader
                ? "bg-[#8B1D35] hover:bg-[#72182b] text-white"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
            title={
              isReader
                ? "Solo lectura"
                : summary.is_complete
                ? "Marcar como comprada"
                : "Faltan partidas por seleccionar"
            }
          >
            <CheckCircle2 size={14} />
            Marcar comprada
          </button>
        </div>
      </div>

      {!summary.is_complete && summary.total_items > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">
          Faltan {summary.missing_items} partida(s) por seleccionar. No se puede
          marcar como comprada hasta completar la selección.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
            <FileText size={16} className="text-[#8B1D35]" />
            Detalle de la requisición
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Solicitante</div>
              <div className="font-semibold text-gray-900">{requisition?.solicitante || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Proyecto / Asunto</div>
              <div className="font-semibold text-gray-900">{requisition?.request_name || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Justificación</div>
              <div className="text-gray-700">{requisition?.justification || requisition?.observation || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Notas</div>
              <div className="text-gray-700">{requisition?.notes || "—"}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-xs font-bold text-gray-500 uppercase">Total general</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{money(totalGeneral)}</div>
          <div className="mt-3 text-[11px] text-gray-500">Subtotal sin IVA</div>

          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Totales por proveedor</div>
            <div className="space-y-2 text-xs">
              {totalsByProvider.map((p) => (
                <div key={p.name} className="flex justify-between">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
            <FileText size={16} className="text-[#8B1D35]" />
            Datos de orden
          </h2>
          <div className="mb-4 border border-gray-200 rounded-lg p-3 bg-white">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Tipo de orden</label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
                disabled={isReader}
              >
                <option value="compra">Compra</option>
                <option value="servicio">Servicio</option>
              </select>
              <button
                onClick={handleSaveType}
                disabled={savingType || isReader}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${
                  savingType || isReader ? "bg-gray-200 text-gray-500" : "bg-[#8B1D35] text-white hover:bg-[#72182b]"
                }`}
              >
                {savingType ? "GUARDANDO..." : isReader ? "SOLO LECTURA" : "GUARDAR"}
              </button>
            </div>
          </div>
          {providersList.length === 0 ? (
            <div className="text-xs text-gray-500">No hay proveedores seleccionados.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {providersList.map((p) => {
                const meta = metaByProvider[p.id] || {
                  folio: "",
                  oc_incluir_iva: false,
                  oc_iva_porcentaje: "",
                };
                return (
                  <div
                    key={p.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 w-full"
                  >
                    <div className="text-[11px] font-bold text-gray-700 mb-2">
                      {p.name}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Número (folio)</label>
                        <input
                          value={meta.folio}
                          onChange={(e) =>
                            setMetaByProvider((prev) => ({
                              ...prev,
                              [p.id]: { ...meta, folio: e.target.value },
                            }))
                          }
                          className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
                          placeholder="Número de orden"
                          disabled={isReader}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={meta.oc_incluir_iva}
                          onChange={(e) =>
                            setMetaByProvider((prev) => ({
                              ...prev,
                              [p.id]: { ...meta, oc_incluir_iva: e.target.checked },
                            }))
                          }
                          className="accent-[#8B1D35]"
                          disabled={isReader}
                        />
                        Incluir IVA
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={meta.oc_iva_porcentaje}
                          onChange={(e) =>
                            setMetaByProvider((prev) => ({
                              ...prev,
                              [p.id]: { ...meta, oc_iva_porcentaje: e.target.value },
                            }))
                          }
                          className="w-24 px-3 py-2 border rounded-lg text-sm bg-white border-gray-300 focus:border-[#8B1D35] focus:ring-1 focus:ring-[#8B1D35] outline-none"
                          disabled={!meta.oc_incluir_iva || isReader}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <button
                        onClick={() => handleSaveMeta(p.id)}
                        disabled={savingMeta || isReader}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold ${
                          savingMeta || isReader ? "bg-gray-200 text-gray-500" : "bg-[#8B1D35] text-white hover:bg-[#72182b]"
                        }`}
                      >
                        {savingMeta ? "GUARDANDO..." : isReader ? "SOLO LECTURA" : "GUARDAR DATOS"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={16} className="text-[#8B1D35]" />
          <h3 className="font-bold text-gray-800 text-sm">Selección por partida</h3>
          <span className="ml-auto text-xs text-gray-400">{rows.length} partida(s)</span>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 text-xs">
              <tr>
                <th className="px-4 py-2 w-16 text-center">Cant.</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2 w-28 text-right">Unidad</th>
                <th className="px-4 py-2">Proveedor</th>
                <th className="px-4 py-2 w-28 text-right">P. Unitario</th>
                <th className="px-4 py-2 w-28 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-gray-400">
                    No hay partidas registradas
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-semibold text-gray-900">{item.description || "—"}</div>
                      {item.selected_description && (
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
                      {money(item.selected_unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {money(item.subtotal)}
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
