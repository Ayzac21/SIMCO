import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import RequisitionModal from "../requisiciones/RequisitionModal";
import ConfirmModal from "../../../components/ConfirmModal";
import { toast } from "sonner";
import { getAuthHeaders } from "../../../api/auth";
import { API_BASE_URL } from "../../../api/config";
import { getRequisitionUnitLabel } from "../../../utils/unitDisplay";
import { getStatusLabel } from "../../../utils/statusDisplay";

const API = API_BASE_URL;

// ✅ util: forzar tiempo mínimo de carga
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Loader (el que mandaste) ---
function AppLoader() {
  return (
    <div className="flex-col gap-4 w-full flex items-center justify-center py-16">
      <div className="w-20 h-20 border-4 border-transparent text-secundario text-4xl animate-spin flex items-center justify-center border-t-secundario rounded-full">
        <div className="w-16 h-16 border-4 border-transparent text-principal text-2xl animate-spin flex items-center justify-center border-t-principal rounded-full" />
      </div>
      <div className="text-xs text-gray-500 mt-2">Cargando...</div>
    </div>
  );
}

// --- Badge unificada (igual que Recibidas) ---
const renderStatusBadge = (statusId, statusName) => {
  let styles = "bg-gray-100 text-gray-600 border-gray-200";

  switch (Number(statusId)) {
    case 8:
      styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
      break;
    case 9:
      styles = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case 10:
      styles = "bg-red-50 text-red-700 border-red-200";
      break;
    case 12:
      styles = "bg-orange-50 text-orange-700 border-orange-200";
      break;
    case 13:
      styles = "bg-indigo-50 text-indigo-700 border-indigo-200";
      break;
    case 11:
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;
    case 14:
      styles = "bg-gray-100 text-gray-700 border-gray-200";
      break;
    default:
      break;
  }

  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold border ${styles} inline-flex items-center gap-1`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
      {getStatusLabel(statusId, statusName)}
    </span>
  );
};

const actionHintByStatus = (statusId) => {
  const st = Number(statusId);
  if (st === 8) return "Acción requerida: revisar y decidir en Coordinación.";
  if (st === 7) return "Pendiente de corrección por la URE.";
  if (st === 9) return "En revisión de Secretaría.";
  if (st === 12) return "En cotización con proveedores (Compras).";
  if (st === 14) return "En revisión interna de Compras.";
  if (st === 13) return "En proceso de compra.";
  if (st === 11) return "Compra finalizada.";
  if (st === 10) return "Requisición rechazada en revisión.";
  return "Sin acción pendiente.";
};

function getCoordinadorId() {
  try {
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const storageId = localStorage.getItem("users_id");
    return storageId || (user ? user.id : null);
  } catch {
    return null;
  }
}

function daysBetween(a, b) {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export default function CoorDashboard() {
  const navigate = useNavigate();
  const coordinadorId = useMemo(() => getCoordinadorId(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allReqs, setAllReqs] = useState([]);

  // Modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [modalItems, setModalItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const fetchData = useCallback(async ({ showRefresh = false } = {}) => {
    if (!coordinadorId) return;

    const MIN_MS = 900;
    const t0 = Date.now();
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`${API}/coordinador/${coordinadorId}/recibidas`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "Error al cargar datos");

      const list = Array.isArray(data) ? data : [];
      setAllReqs(list);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el dashboard");
    } finally {
      const elapsed = Date.now() - t0;
      if (showRefresh && elapsed < MIN_MS) {
        await sleep(MIN_MS - elapsed);
      }
      if (showRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [coordinadorId]);

  useEffect(() => {
    fetchData({ showRefresh: false });
  }, [fetchData]);

  // ===== DERIVADOS =====
  const stats = useMemo(() => {
    const list = allReqs;

    const pendientesList = list.filter((r) => Number(r.statuses_id) === 8);
    const procesadasList = list.filter((r) =>
      [9, 11, 12, 13, 14].includes(Number(r.statuses_id))
    );
    const rechazadasList = list.filter((r) => Number(r.statuses_id) === 10);

    const hoy = new Date();
    const rezagadasList = pendientesList.filter((r) => {
      const fecha = new Date(r.created_at);
      return daysBetween(hoy, fecha) > 3;
    });

    return {
      pendientes: pendientesList.length,
      procesadas: procesadasList.length,
      rechazadas: rechazadasList.length,
      rezagadas: rezagadasList.length,
    };
  }, [allReqs]);

  const recentReqs = useMemo(() => {
    const sorted = [...allReqs].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    return sorted.slice(0, 6);
  }, [allReqs]);

  const topUres = useMemo(() => {
    const sorted = [...allReqs].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const conteo = {};
    sorted.forEach((req) => {
      const ure = getRequisitionUnitLabel(req, "Unidad solicitante");
      conteo[ure] = (conteo[ure] || 0) + 1;
    });

    return Object.entries(conteo)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [allReqs]);

  const totalGlobal = allReqs.length || 0;

  // ===== Modal helpers =====
  const handleRowClick = async (req) => {
    // ✅ evita doble click mientras carga
    if (loadingItems) return;

    setSelectedReq(req);
    setModalItems([]);
    setLoadingItems(true);

    const MIN_MS = 1500;
    const t0 = Date.now();

    try {
      const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/items`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || "No se pudieron cargar partidas");

      // ✅ forzar mínimo de 1–2s
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_MS) await sleep(MIN_MS - elapsed);

      setModalItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);

      // ✅ también respetamos el mínimo para que no parpadee
      const elapsed = Date.now() - t0;
      if (elapsed < MIN_MS) await sleep(MIN_MS - elapsed);

      toast.error("No se pudo cargar el detalle");
    } finally {
      setLoadingItems(false);
    }
  };

  // ✅ Actualiza en memoria (sin reload)
  const patchReqStatusLocal = (reqId, newStatusId, newStatusName = "") => {
    setAllReqs((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(reqId)
          ? {
              ...r,
              statuses_id: Number(newStatusId),
              nombre_estatus: newStatusName || r.nombre_estatus,
            }
          : r
      )
    );
  };

  const removeReqLocal = (reqId) => {
    setAllReqs((prev) => prev.filter((r) => Number(r.id) !== Number(reqId)));
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status_id: 10, comentarios: reason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo rechazar");

      toast.success("Requisición rechazada");

      patchReqStatusLocal(req.id, 10, "Rechazada");
      setSelectedReq(null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo rechazar");
    }
  };

  const handleRequestChanges = async (req, reason) => {
    try {
      const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/estatus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          status_id: 7,
          comentarios: `AJUSTE_COORDINACION: ${reason}`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo solicitar ajustes");

      toast.success("Ajustes solicitados a la URE");
      removeReqLocal(req.id);
      setSelectedReq(null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo solicitar ajustes");
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

  const handleDownloadSignaturePdf = async (reqId) => {
    const popup = window.open("", "_blank");
    if (!popup) {
      toast.error("Tu navegador bloqueó la nueva ventana del PDF");
      return;
    }
    popup.document.write("Cargando PDF...");

    try {
      const res = await fetch(`${API}/requisiciones/${reqId}/pdf-firma`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo generar el PDF");
      }

      const blob = await res.blob();
      const disposition = String(res.headers.get("content-disposition") || "");
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const rawFilename = (match?.[1] || `requisicion-${reqId}-firma.pdf`).replace(/"/g, "");
      let filename = rawFilename;
      try {
        filename = decodeURIComponent(rawFilename);
      } catch {
        filename = rawFilename;
      }

      const url = window.URL.createObjectURL(blob);
      popup.document.title = filename;
      popup.location.href = url;
      setTimeout(() => window.URL.revokeObjectURL(url), 15000);
    } catch (e) {
      popup.close();
      toast.error(e?.message || "No se pudo abrir el PDF");
    }
  };

  const handleConfirm = async () => {
    if (!confirmConfig?.req) return;
    const req = confirmConfig.req;

    if (confirmConfig.type === "approve") {
      try {
        const res = await fetch(`${API}/coordinador/requisiciones/${req.id}/estatus`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ status_id: 9, comentarios: "Autorizado por Coordinación" }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "No se pudo autorizar");

        toast.success("Enviada a Secretaría");
        patchReqStatusLocal(req.id, 9, "Secretaría");
        setSelectedReq(null);
      } catch (e) {
        console.error(e);
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
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "No se pudo enviar");

        toast.success("Enviada a Secretaría");
        patchReqStatusLocal(req.id, 9, "Secretaría");
        setSelectedReq(null);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo enviar");
      } finally {
        setConfirmOpen(false);
        setConfirmConfig(null);
      }
    }
  };

  if (!coordinadorId) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-600">
        No se encontró el usuario coordinador. Vuelve a iniciar sesión.
      </div>
    );
  }

  // ✅ Loader centrado con tu icono
  if (loading) {
    return <AppLoader />;
  }

  return (
    <div className="relative space-y-6">
      {refreshing && !loading && (
        <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
          <AppLoader label="Actualizando..." />
        </div>
      )}
      <RequisitionModal
        req={selectedReq}
        items={modalItems}
        loadingItems={loadingItems}
        onClose={() => (loadingItems ? null : setSelectedReq(null))}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestChanges={handleRequestChanges}
        onEditDraft={handleEditDraft}
        onSendDraft={handleSendDraft}
        onDownloadSignaturePdf={handleDownloadSignaturePdf}
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

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg md:text-xl font-extrabold text-gray-800">Dashboard de Coordinación</h1>
        <button
          onClick={() => fetchData({ showRefresh: true })}
          disabled={refreshing || loading}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold text-white bg-secundario inline-flex items-center gap-2 ${
            refreshing || loading ? "opacity-70 cursor-not-allowed" : "hover:bg-secundario/90"
          }`}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Pendientes
            </p>
            <p className="text-3xl font-bold text-gray-800">{stats.pendientes}</p>
            <p className="text-[10px] text-gray-500 mt-1">Estatus 8</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-full">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
        </div>

        <div
          className={`p-6 rounded-xl border shadow-sm flex items-center justify-between ${
            stats.rezagadas > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
          }`}
        >
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                stats.rezagadas > 0 ? "text-red-600" : "text-gray-400"
              }`}
            >
              Urgentes
            </p>
            <p
              className={`text-3xl font-bold ${
                stats.rezagadas > 0 ? "text-red-700" : "text-gray-800"
              }`}
            >
              {stats.rezagadas}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">+3 días sin respuesta</p>
          </div>
          <div className={`p-3 rounded-full ${stats.rezagadas > 0 ? "bg-red-200" : "bg-gray-100"}`}>
            <AlertTriangle className={`w-6 h-6 ${stats.rezagadas > 0 ? "text-red-700" : "text-gray-400"}`} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Procesadas
            </p>
            <p className="text-3xl font-bold text-gray-800">{stats.procesadas}</p>
            <p className="text-[10px] text-gray-500 mt-1">Avanzaron de coordinación</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-full">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Rechazadas
            </p>
            <p className="text-3xl font-bold text-gray-800">{stats.rechazadas}</p>
            <p className="text-[10px] text-gray-500 mt-1">Estatus 10</p>
          </div>
          <div className="p-3 bg-gray-100 rounded-full">
            <XCircle className="w-6 h-6 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Tabla y Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actividad */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-gray-400" /> Actividad Reciente
            </h3>

            <button
              onClick={() => navigate("/coordinador/requisiciones")}
              className="text-xs text-principal font-bold hover:underline"
            >
              VER TODO
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100">
                {recentReqs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-5 text-center text-sm text-gray-400">
                      No hay requisiciones recientes para mostrar
                    </td>
                  </tr>
                ) : (
                  recentReqs.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(req)}
                      title={loadingItems ? "Cargando..." : "Ver detalle"}
                    >
                      <td className="px-5 py-3 w-[80px]">
                        <span className="font-bold text-gray-700 text-sm">#{req.id}</span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-sm font-medium text-gray-800 truncate max-w-[240px]">
                          {req.request_name || "Sin nombre"}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {req.solicitante || "—"}{" "}
                          {`• ${getRequisitionUnitLabel(req, "Unidad solicitante")}`}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-xs text-gray-500">
                          {req.category_name || req.categoria || ""}
                        </div>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {renderStatusBadge(req.statuses_id, req.nombre_estatus)}
                          <p className="text-[11px] text-gray-500 max-w-[260px] text-right leading-snug">
                            {actionHintByStatus(req.statuses_id)}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col h-full">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" /> Top Departamentos
          </h3>

          <div className="space-y-4 flex-1">
            {topUres.length === 0 ? (
              <p className="text-xs text-gray-400">No hay datos</p>
            ) : (
              topUres.map((ure, index) => {
                const porcentaje = totalGlobal > 0 ? (ure.total / totalGlobal) * 100 : 0;

                return (
                  <div key={index} className="w-full">
                    <div className="flex justify-between items-center text-sm mb-1 w-full">
                      <span
                        className="font-medium text-gray-600 truncate flex-1 pr-2"
                        title={ure.nombre}
                      >
                        {ure.nombre}
                      </span>
                      <span className="font-bold text-gray-800 whitespace-nowrap text-xs">
                        {ure.total} reqs
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-principal h-2 rounded-full opacity-80"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-800 text-center">
              💡 <strong>Tip:</strong> Revisa primero las “Urgentes” (+3 días).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
