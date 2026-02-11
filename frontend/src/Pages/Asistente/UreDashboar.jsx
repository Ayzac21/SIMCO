import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Clock3, CheckCircle2, XCircle, ArrowRight, X, User, Info } from "lucide-react";
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";

const API = API_BASE_URL;
const PRIMARY = "#8B1D35";

function getUserId() {
  try {
    const direct = localStorage.getItem("users_id");
    if (direct) return Number(direct);

    const userStr = localStorage.getItem("usuario");
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u?.id) return Number(u.id);
      if (u?.users_id) return Number(u.users_id);
    }
  } catch {}
  return 1;
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function badgeByStatus(statusId, statusName) {
  let cls = "bg-gray-100 text-gray-700 border-gray-200";

  switch (Number(statusId)) {
    case 7:
      cls = "bg-orange-50 text-orange-800 border-orange-200";
      break;
    case 8:
      cls = "bg-yellow-50 text-yellow-700 border-yellow-200";
      break;
    case 9:
      cls = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    case 10:
      cls = "bg-red-50 text-red-700 border-red-200";
      break;
    case 12:
      cls = "bg-orange-50 text-orange-700 border-orange-200";
      break;
    case 11:
    case 13:
      cls = "bg-secundario/10 text-secundario border-secundario/20";
      break;
    case 14:
      cls = "bg-gray-100 text-gray-700 border-gray-200";
      break;
    default:
      break;
  }

  return { text: statusName || "Sin estatus", cls };
}

function nextStepText(statusId) {
  const st = Number(statusId);
  if (st === 7) return "Te falta enviar esta solicitud.";
  if (st === 14) return "Toca elegir un proveedor.";
  if (st === 10) return "Fue rechazada. Revisa las notas.";
  if (st === 13) return "Compras ya está haciendo el pedido.";
  if (st === 11) return "Listo: ya fue comprada.";
  if (st === 8) return "Está en Coordinación.";
  if (st === 9) return "Está en Secretaría.";
  if (st === 12) return "Compras está cotizando.";
  return "Revisa el detalle.";
}

export default function UreDashboard() {
  const navigate = useNavigate();
  const usersId = useMemo(() => getUserId(), []);

  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState({
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    total: 0,
  });

  const [needsAction, setNeedsAction] = useState({ borradores: 0, en_revision: 0 });
  const [latest, setLatest] = useState([]);

  const [open, setOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [statsRes, listRes] = await Promise.all([
        fetch(`${API}/requisiciones/dashboard/${usersId}/stats`, { headers: getAuthHeaders() }),
        fetch(`${API}/requisiciones/mis-requisiciones/${usersId}`, { headers: getAuthHeaders() }),
      ]);

      const statsData = await statsRes.json().catch(() => ({}));
      const listData = await listRes.json().catch(() => ([]));

      if (!statsRes.ok || !statsData?.ok) {
        throw new Error(statsData?.message || "No se pudo cargar stats");
      }

      const reqs = Array.isArray(listData) ? listData : [];

      const borradores = reqs.filter((r) => Number(r.statuses_id) === 7).length;
      const en_revision = reqs.filter((r) => Number(r.statuses_id) === 14).length;

      setSummary({
        pendientes: Number(statsData.pendientes || 0),
        aprobadas: Number(statsData.aprobadas || 0),
        rechazadas: Number(statsData.rechazadas || 0),
        total: Number(statsData.total || 0),
      });

      setNeedsAction({ borradores, en_revision });

      setLatest(reqs.slice(0, 5));
    } catch (e) {
      console.error(e);
      toast.error("Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeModal = () => {
    setOpen(false);
    setSelectedRow(null);
    setDetail(null);
    setDetailLoading(false);
  };

  const openModal = async (row) => {
    setSelectedRow(row);
    setDetail(null);
    setOpen(true);

    try {
      setDetailLoading(true);

      const resp = await fetch(`${API}/requisiciones/${row.id}`, { headers: getAuthHeaders() });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) throw new Error(data?.message || "No se pudo cargar la requisición");
      setDetail(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo abrir la requisición");
    } finally {
      setDetailLoading(false);
    }
  };

  const continuar = () => {
    if (!selectedRow) return;

    const st = Number(selectedRow.statuses_id);
    const rid = selectedRow.id;

    closeModal();

    if (st === 7) return navigate(`/unidad/requisiciones/editar/${rid}`);
    if (st === 14) return navigate(`/unidad/revision/${rid}`);
    return navigate(`/unidad/mi-requisiciones`);
  };

  const StatCard = ({ label, value, icon, iconBg, helper }) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900">{loading ? "—" : value}</p>
        {helper ? <p className="text-xs text-gray-500 mt-1">{helper}</p> : null}
      </div>
      <div className={`p-3 rounded-full ${iconBg}`}>{icon}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {open && selectedRow && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="text-[#8B1D35]" size={18} />
                    <div className="font-extrabold text-gray-900 truncate">
                      {detail?.request_name || selectedRow?.categoria || "Requisición"}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Folio: <span className="font-extrabold text-gray-800">#{selectedRow.id}</span> •{" "}
                    <span className="font-extrabold text-gray-800">{selectedRow.area_folio}</span> •{" "}
                    {selectedRow.categoria}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {(() => {
                      const b = badgeByStatus(selectedRow.statuses_id, selectedRow.estatus);
                      return (
                        <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-extrabold border ${b.cls} inline-flex items-center gap-1`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                          {b.text}
                        </span>
                      );
                    })()}

                    <span className="text-xs text-gray-600">• {nextStepText(selectedRow.statuses_id)}</span>
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  title="Cerrar"
                >
                  <X size={18} className="text-gray-700" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {detailLoading ? (
                  <div className="text-sm text-gray-500">Cargando detalle...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-blue-700">
                          <User size={14} /> SOLICITANTE
                        </div>
                        <div className="text-sm font-extrabold text-gray-900 mt-1">
                          {detail?.solicitante?.trim() ? detail.solicitante : "—"}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">{detail?.ure?.trim() ? detail.ure : ""}</div>
                      </div>

                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-red-700">
                          <Info size={14} /> NOTAS
                        </div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.notes?.trim() ? detail.notes : <span className="text-gray-600">Sin notas</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="text-xs font-extrabold text-indigo-700">JUSTIFICACIÓN</div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.justification?.trim() ? detail.justification : <span className="text-gray-600">Sin justificación</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-extrabold text-amber-700">OBSERVACIONES</div>
                        <div className="text-sm text-gray-800 mt-1">
                          {detail?.observation?.trim() ? detail.observation : <span className="text-gray-600">Sin observaciones</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-extrabold text-gray-800 uppercase tracking-wide mb-2">Lista de artículos</div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3">Producto</th>
                              <th className="text-left px-4 py-3">Descripción</th>
                              <th className="text-right px-4 py-3">Cant.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(detail?.partidas || []).map((p) => (
                              <tr key={p.id}>
                                <td className="px-4 py-3 font-semibold text-gray-900">{p.product_name || "—"}</td>
                                <td className="px-4 py-3 text-gray-700">{p.description || "—"}</td>
                                <td className="px-4 py-3 text-right font-extrabold text-gray-900">{p.quantity ?? "—"}</td>
                              </tr>
                            ))}

                            {(!detail?.partidas || detail.partidas.length === 0) && (
                              <tr>
                                <td className="px-4 py-5 text-center text-gray-500" colSpan={3}>
                                  No hay artículos.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-5 border-t border-gray-100 flex items-center justify-between gap-3">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gray-100 hover:bg-gray-200 text-gray-900">
                  Cerrar
                </button>

                <button
                  onClick={continuar}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Continuar <ArrowRight size={14} className="inline ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ color: PRIMARY }}>
            Tus solicitudes
          </h1>
          <p className="text-gray-700 mt-1">Aquí puedes ver tus solicitudes y continuar donde te quedaste.</p>
        </div>

        <button onClick={loadDashboard} className="px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm" style={{ backgroundColor: PRIMARY }}>
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="En trámite" value={summary.pendientes} helper="Aún no finalizadas" iconBg="bg-yellow-50" icon={<Clock3 className="w-6 h-6 text-yellow-600" />} />
        <StatCard label="Listas" value={summary.aprobadas} helper="Ya avanzaron / completadas" iconBg="bg-blue-50" icon={<CheckCircle2 className="w-6 h-6 text-blue-600" />} />
        <StatCard label="Rechazadas" value={summary.rechazadas} helper="Revisa notas" iconBg="bg-gray-100" icon={<XCircle className="w-6 h-6 text-gray-500" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button onClick={() => navigate("/unidad/mi-requisiciones")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:bg-gray-50 transition">
          <div className="text-sm font-extrabold text-gray-900">Borradores</div>
          <div className="text-xs text-gray-500 mt-1">Edita y envía lo que quedó pendiente.</div>
          <div className="mt-3 text-2xl font-extrabold text-gray-900">{loading ? "—" : needsAction.borradores}</div>
        </button>

        <button onClick={() => navigate("/unidad/revision")} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left hover:bg-gray-50 transition">
          <div className="text-sm font-extrabold text-gray-900">En revisión</div>
          <div className="text-xs text-gray-500 mt-1">Elige un proveedor por partida.</div>
          <div className="mt-3 text-2xl font-extrabold text-gray-900">{loading ? "—" : needsAction.en_revision}</div>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={18} className="text-gray-400" /> Actividad Reciente
          </h3>
          <button onClick={() => navigate("/unidad/mi-requisiciones")} className="text-xs font-extrabold hover:underline" style={{ color: PRIMARY }}>
            VER TODO
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan="2" className="p-5 text-center text-sm text-gray-400">
                    Cargando...
                  </td>
                </tr>
              )}

              {!loading && latest.length === 0 && (
                <tr>
                  <td colSpan="2" className="p-5 text-center text-sm text-gray-400">
                    Sin actividad reciente
                  </td>
                </tr>
              )}

              {!loading &&
                latest.map((req) => {
                  const b = badgeByStatus(req.statuses_id, req.estatus);
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openModal(req)}
                      title="Clic para ver"
                    >
                      <td className="px-5 py-4 w-[90px] align-top">
                        <span className="font-extrabold text-gray-800 text-sm">#{req.id}</span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{req.categoria}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {req.area_folio} • {fmtDate(req.created_at)}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">{nextStepText(req.statuses_id)}</div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-extrabold border ${b.cls} inline-flex items-center gap-1`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                              {b.text}
                            </span>

                            <span className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-400" aria-hidden="true">
                              <ArrowRight size={16} />
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
