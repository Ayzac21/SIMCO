import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "./PageHeader";
import { toast } from "sonner";

/* ICONO ELIMINAR */
const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

/* LABEL */
const Label = ({ children, required }) => (
  <label className="block text-sm font-bold text-gray-800 mb-2">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const API = "http://localhost:4000/api";
const PRIMARY = "#8B1D35";

/** ✅ Modal confirmación (inline, con tu estilo) */
function ConfirmModal({
  open,
  title = "Confirmar",
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
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
        <div className="px-5 py-4" style={{ backgroundColor: PRIMARY }}>
          <div className="text-white font-bold text-sm">{title}</div>
          <div className="text-white/80 text-xs mt-1">Revisa antes de continuar</div>
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
              className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? "PROCESANDO..." : confirmText}
            </button>
          </div>

          <div className="mt-3 text-[11px] text-gray-500">
            * Esto cambiará el estatus de la requisición.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditarRequisicion() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [requestName, setRequestName] = useState("");
  const [justification, setJustification] = useState("");
  const [observation, setObservation] = useState("");
  const [estatusId, setEstatusId] = useState(null);

  const [partidas, setPartidas] = useState([]);
  const [units, setUnits] = useState([]);

  // ✅ Modal enviar
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const isBorrador = Number(estatusId) === 7;

  /* ===== FETCH ===== */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const [resReq, resUnits] = await Promise.all([
          fetch(`${API}/requisiciones/${id}`),
          fetch(`${API}/units`),
        ]);

        const dataReq = await resReq.json().catch(() => ({}));
        const dataUnits = await resUnits.json().catch(() => []);

        if (!resReq.ok) throw new Error(dataReq?.message || "No se pudo cargar requisición");

        setRequestName(dataReq.request_name || "");
        setJustification(dataReq.justification || "");
        setObservation(dataReq.observation || "");
        setEstatusId(Number(dataReq.statuses_id));

        setPartidas(
          (dataReq.partidas || []).map((p) => ({
            ...p,
            unique_key: p.id || crypto.randomUUID(),
            quantity: p.quantity ?? "",
            units_id: p.units_id ?? "",
            product_name: p.product_name ?? "",
            description: p.description ?? "",
          }))
        );

        if (Array.isArray(dataUnits)) setUnits(dataUnits);
      } catch (err) {
        console.error(err);
        toast.error("Error cargando requisición", {
          description: err?.message || "Intenta de nuevo",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [id]);

  /* ===== ACCIONES ===== */
  const agregarPartida = () => {
    if (!isBorrador) return;
    setPartidas([
      ...partidas,
      {
        id: null,
        unique_key: crypto.randomUUID(),
        product_name: "",
        description: "",
        quantity: "",
        units_id: "",
      },
    ]);
  };

  const eliminarPartida = (index) => {
    if (!isBorrador) return;
    const copia = [...partidas];
    copia.splice(index, 1);
    setPartidas(copia);
  };

  const actualizarPartida = (index, field, value) => {
    if (!isBorrador) return;
    const copia = [...partidas];
    copia[index][field] = value;
    setPartidas(copia);
  };

  const validate = () => {
    if (!requestName.trim()) {
      toast.warning("Falta el nombre", { description: "El nombre de la solicitud es obligatorio." });
      return false;
    }
    if (!partidas.length) {
      toast.warning("Sin artículos", { description: "Agrega al menos un artículo." });
      return false;
    }
    for (let i = 0; i < partidas.length; i++) {
      const p = partidas[i];
      if (!p.product_name?.trim()) {
        toast.warning("Partida incompleta", { description: `La partida #${i + 1} no tiene producto.` });
        return false;
      }
      if (p.quantity === "" || Number(p.quantity) <= 0) {
        toast.warning("Cantidad inválida", { description: `La partida #${i + 1} tiene cantidad inválida.` });
        return false;
      }
      if (!p.units_id) {
        toast.warning("Unidad faltante", { description: `La partida #${i + 1} no tiene unidad de medida.` });
        return false;
      }
    }
    return true;
  };

  const guardarCambios = async ({ silent = false } = {}) => {
    if (!isBorrador) {
      toast.warning("No editable", { description: "Solo puedes editar cuando está en borrador." });
      return false;
    }
    if (saving || sending) return false;
    if (!validate()) return false;

    try {
      setSaving(true);

      const partidasLimpias = partidas.map(({ unique_key, ...rest }) => ({
        ...rest,
        quantity: Number(rest.quantity),
        units_id: Number(rest.units_id),
      }));

      const resp = await fetch(`${API}/requisiciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_name: requestName,
          justification,
          observation,
          partidas: partidasLimpias,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudieron guardar los cambios");
      }

      if (!silent) {
        toast.success("Cambios guardados", { description: "Se actualizaron los datos del borrador." });
      }

      return true;
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar", { description: e?.message || "Intenta de nuevo" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ✅ abre modal
  const pedirConfirmacionEnviar = () => {
    if (!isBorrador) {
      toast.warning("No se puede enviar", { description: "Solo se envía cuando está en borrador." });
      return;
    }
    if (!validate()) return;
    setConfirmSendOpen(true);
  };

  // ✅ confirma modal
  const guardarYEnviar = async () => {
    if (sending || saving) return;

    setConfirmSendOpen(false);

    const ok = await guardarCambios({ silent: true });
    if (!ok) return;

    try {
      setSending(true);

      const resp = await fetch(`${API}/requisiciones/${id}/enviar`, {
        method: "PATCH",
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudo enviar la requisición");
      }

      toast.success("Requisición enviada", {
        description: "Se envió a Coordinación correctamente.",
        duration: 3000,
      });

      setEstatusId(8);
      navigate("/unidad/mi-requisiciones");
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar", { description: e?.message || "Intenta de nuevo" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Cargando...</div>;
  }

  /* INPUT NEUTRO */
  const inputStyle =
    "w-full p-2.5 border border-gray-300 rounded-md text-gray-700 bg-white " +
    "focus:outline-none focus:border-gray-400 focus:ring-0 transition";

  return (
    <>
      <PageHeader
        title="Editar Requisición"
        subtitle="Modifica los detalles de la solicitud existente"
      />

      {/* ✅ Modal Confirmación Enviar */}
      <ConfirmModal
        open={confirmSendOpen}
        loading={sending}
        title="Enviar a Coordinación"
        description="¿Deseas enviar esta requisición a Coordinación? Al confirmar, ya no podrás editar el borrador."
        confirmText="Sí, enviar"
        cancelText="Revisar"
        onCancel={() => setConfirmSendOpen(false)}
        onConfirm={guardarYEnviar}
      />

      <div className="w-full min-h-screen bg-[#F3F4F6] p-6 md:p-10">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

          {/* ===== FORMULARIO ===== */}
          <div className="flex-1 p-8 border-r border-gray-100">
            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-800">
                Datos de la Solicitud
              </h2>
              {isBorrador && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                  Editando Borrador
                </span>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <Label>Categoría</Label>
                <select className={inputStyle} disabled>
                  <option>Materiales y Suministros</option>
                </select>
              </div>

              <div>
                <Label required>Nombre de la Solicitud</Label>
                <input
                  className={inputStyle}
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  disabled={!isBorrador}
                />
              </div>

              <div>
                <Label>Justificación</Label>
                <textarea
                  rows="3"
                  className={inputStyle}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={!isBorrador}
                />
              </div>

              <div>
                <Label>Observaciones</Label>
                <textarea
                  rows="3"
                  className={inputStyle}
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  disabled={!isBorrador}
                />
              </div>

              {!isBorrador && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                  Esta requisición ya no está en borrador, por eso no se puede editar.
                </div>
              )}
            </div>
          </div>

          {/* ===== PARTIDAS ===== */}
          <div className="w-full lg:w-[400px] bg-[#F9FAFB] flex flex-col border-l border-gray-200">

            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xs font-bold text-gray-500 uppercase">
                Resumen de Requisición
              </h3>
              <p className="text-xl font-bold text-gray-800 mt-1">
                Lista de Artículos
              </p>
            </div>

            {/* SCROLL SOLO AQUÍ */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-340px)]">
              <AnimatePresence>
                {partidas.map((p, index) => (
                  <motion.div
                    key={p.unique_key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-4 rounded-lg border border-gray-200 relative"
                  >
                    {isBorrador && (
                      <button
                        onClick={() => eliminarPartida(index)}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                        title="Eliminar"
                      >
                        <IconTrash />
                      </button>
                    )}

                    <input
                      className="w-full font-semibold border-b border-gray-200 focus:outline-none focus:border-gray-400"
                      placeholder="Producto"
                      value={p.product_name}
                      disabled={!isBorrador}
                      onChange={(e) =>
                        actualizarPartida(index, "product_name", e.target.value)
                      }
                    />

                    <textarea
                      className="w-full mt-2 p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-gray-400"
                      rows="2"
                      placeholder="Descripción"
                      value={p.description}
                      disabled={!isBorrador}
                      onChange={(e) =>
                        actualizarPartida(index, "description", e.target.value)
                      }
                    />

                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        className="w-1/2 p-2 border border-gray-300 rounded focus:outline-none focus:border-gray-400"
                        value={p.quantity}
                        disabled={!isBorrador}
                        onChange={(e) =>
                          actualizarPartida(index, "quantity", e.target.value)
                        }
                      />
                      <select
                        className="w-1/2 p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-400"
                        value={p.units_id}
                        disabled={!isBorrador}
                        onChange={(e) =>
                          actualizarPartida(index, "units_id", e.target.value)
                        }
                      >
                        <option value="">U. Medida</option>
                        {units.length ? (
                          units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))
                        ) : (
                          <>
                            {/* fallback visual si no cargó units */}
                            <option value="1">PZA</option>
                            <option value="2">CJA</option>
                          </>
                        )}
                      </select>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                onClick={agregarPartida}
                disabled={!isBorrador || saving || sending}
                className="w-full py-3 text-sm font-semibold border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                + Agregar Artículo
              </button>
            </div>

            {/* ✅ Manteniendo tu diseño: footer con botón grande */}
            <div className="p-6 border-t border-gray-200 bg-white space-y-3">
              <button
                onClick={() => guardarCambios()}
                disabled={!isBorrador || saving || sending}
                className="w-full py-3 bg-principal text-white font-bold rounded shadow hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando..." : "Confirmar y Guardar Cambios →"}
              </button>

              {/* ✅ Botón secundario para enviar (solo borrador) */}
              {isBorrador && (
                <button
                  onClick={pedirConfirmacionEnviar}
                  disabled={saving || sending}
                  className="w-full py-3 font-bold rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ color: PRIMARY }}
                  title="Enviar a Coordinación"
                >
                  {sending ? "Enviando..." : "Guardar y Enviar a Coordinación →"}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
