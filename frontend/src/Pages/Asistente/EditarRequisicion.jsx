import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";
import useEscapeKey from "../../hooks/useEscapeKey";
import { safeUUID } from "../../utils/uuid";

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
  <label className="block text-sm font-bold text-gray-800 mb-1.5">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const API = API_BASE_URL;
const PRIMARY = "#8B1D35";

const statusMeta = (statusId) => {
  const st = Number(statusId);
  if (st === 14) {
    return {
      label: "En revisión interna de Compras",
      detail: "Compras Admin está realizando la selección final de proveedores.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 8) {
    return {
      label: "En Coordinación",
      detail: "Ya fue enviada a Coordinación. Está pendiente de validación.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 9) {
    return {
      label: "En Secretaría",
      detail: "Ya pasó a Secretaría para revisión administrativa.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 12) {
    return {
      label: "En cotización",
      detail: "Compras está cotizando proveedores para esta requisición.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 13) {
    return {
      label: "En proceso de compra",
      detail: "La compra ya está en proceso y este borrador quedó cerrado.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 11) {
    return {
      label: "Finalizada",
      detail: "La requisición ya se completó. No requiere edición.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  if (st === 10) {
    return {
      label: "Rechazada",
      detail: "Fue rechazada. Revisa el motivo en el detalle y crea/ajusta una nueva.",
      actionLabel: "Ver mis requisiciones",
      actionPath: "/unidad/mi-requisiciones",
    };
  }
  return {
    label: "Fuera de borrador",
    detail: "Esta requisición ya cambió de etapa y no se puede editar desde aquí.",
    actionLabel: "Ver mis requisiciones",
    actionPath: "/unidad/mi-requisiciones",
  };
};

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
  useEscapeKey(open, () => {
    if (!loading) onCancel?.();
  }, loading);

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
  const [categoryName, setCategoryName] = useState("");
  const [justification, setJustification] = useState("");
  const [observation, setObservation] = useState("");
  const [estatusId, setEstatusId] = useState(null);
  const [resumeTo, setResumeTo] = useState(8);
  const [adjustmentMessage, setAdjustmentMessage] = useState("");
  const [adjustmentSource, setAdjustmentSource] = useState("");

  const [partidas, setPartidas] = useState([]);
  const [units, setUnits] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [partidaPhotoDrafts, setPartidaPhotoDrafts] = useState({});

  // ✅ Modal enviar
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const isBorrador = Number(estatusId) === 7;
  const currentStatusMeta = statusMeta(estatusId, id);
  const maxAttachments = 5;

  const fmtSize = (bytes) => {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const partidaImageEndpoint = (lineItemId) =>
    `${API}/requisiciones/${id}/partidas/${lineItemId}/image`;

  const hydratePartidaImages = async (mappedPartidas) => {
    const withImage = (mappedPartidas || []).filter(
      (p) => p.id && (p.image_original_name || p.image_mime_type || p.image_size_bytes)
    );
    if (!withImage.length) {
      setPartidaPhotoDrafts({});
      return;
    }

    const entries = await Promise.all(
      withImage.map(async (p) => {
        try {
          const resp = await fetch(partidaImageEndpoint(p.id), { headers: getAuthHeaders() });
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const fallbackName =
            p.image_original_name ||
            `partida-${p.id}.${String(blob.type || "").includes("png") ? "png" : "jpg"}`;
          const previewUrl = URL.createObjectURL(blob);
          return [
            p.unique_key,
            {
              file: { name: fallbackName, size: Number(p.image_size_bytes || blob.size || 0) },
              previewUrl,
              fromServer: true,
              isLocalFile: false,
              lineItemId: p.id,
            },
          ];
        } catch {
          return null;
        }
      })
    );

    const nextDrafts = {};
    entries.filter(Boolean).forEach(([key, value]) => {
      nextDrafts[key] = value;
    });
    setPartidaPhotoDrafts(nextDrafts);
  };

  /* ===== FETCH ===== */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const [resReq, resUnits] = await Promise.all([
          fetch(`${API}/requisiciones/${id}`, { headers: getAuthHeaders() }),
          fetch(`${API}/units`, { headers: getAuthHeaders() }),
        ]);

        const dataReq = await resReq.json().catch(() => ({}));
        const dataUnits = await resUnits.json().catch(() => []);

        if (!resReq.ok) throw new Error(dataReq?.message || "No se pudo cargar requisición");

        setRequestName(dataReq.request_name || "");
        setCategoryName(dataReq.categoria || "Sin categoría");
        setJustification(dataReq.justification || "");
        setObservation(dataReq.observation || "");
        setEstatusId(Number(dataReq.statuses_id));
        const rawNotes = String(dataReq.notes || "");
        if (rawNotes.startsWith("AJUSTE_COMPRAS:")) {
          setResumeTo(12);
          setAdjustmentSource("Compras");
          setAdjustmentMessage(rawNotes.replace("AJUSTE_COMPRAS:", "").trim());
        } else if (rawNotes.startsWith("AJUSTE_SECRETARIA:")) {
          setResumeTo(9);
          setAdjustmentSource("Secretaría");
          setAdjustmentMessage(rawNotes.replace("AJUSTE_SECRETARIA:", "").trim());
        } else if (rawNotes.startsWith("AJUSTE_COORDINACION:")) {
          setResumeTo(8);
          setAdjustmentSource("Coordinación");
          setAdjustmentMessage(rawNotes.replace("AJUSTE_COORDINACION:", "").trim());
        } else {
          setResumeTo(8);
          setAdjustmentSource("");
          setAdjustmentMessage("");
        }

        const mappedPartidas = (dataReq.partidas || []).map((p) => ({
          ...p,
          unique_key: p.id || safeUUID(),
          quantity: p.quantity ?? "",
          units_id: p.units_id ?? "",
          product_name: p.product_name ?? "",
          description: p.description ?? "",
          image_original_name: p.image_original_name ?? null,
          image_mime_type: p.image_mime_type ?? null,
          image_size_bytes: p.image_size_bytes ?? null,
        }));
        setPartidas(mappedPartidas);
        await hydratePartidaImages(mappedPartidas);
        setAttachments(Array.isArray(dataReq.attachments) ? dataReq.attachments : []);

        if (Array.isArray(dataUnits)) setUnits(dataUnits);
      } catch (err) {
        console.error(err);
        toast.error("Error cargando requisición");
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
        unique_key: safeUUID(),
        product_name: "",
        description: "",
        quantity: "",
        units_id: "",
      },
    ]);
  };

  const processPickedAttachments = (rawFiles) => {
    const files = Array.from(rawFiles || []);
    if (!files.length) return;
    const valid = files.filter((f) => {
      const type = String(f.type || "").toLowerCase();
      const name = String(f.name || "").toLowerCase();
      const byMime = type.includes("pdf") || type.startsWith("image/");
      const byExt = [".pdf", ".png", ".jpg", ".jpeg", ".webp"].some((ext) => name.endsWith(ext));
      return byMime || byExt;
    });
    if (valid.length !== files.length) {
      toast.warning("Solo se permiten imágenes (PNG/JPG/WEBP) y PDF");
    }
    const available = Math.max(0, maxAttachments - attachments.length - pendingAttachments.length);
    const accepted = valid.slice(0, available);
    if (accepted.length < valid.length) {
      toast.warning(`Solo puedes tener ${maxAttachments} adjuntos por requisición`);
    }
    setPendingAttachments((prev) => [...prev, ...accepted]);
  };

  const onPickAttachments = (e) => {
    processPickedAttachments(e.target.files);
    e.target.value = "";
  };

  const removePendingAttachment = (index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async () => {
    if (!pendingAttachments.length) return;
    if (uploadingAttachments) return;
    try {
      setUploadingAttachments(true);
      const fd = new FormData();
      pendingAttachments.forEach((file) => fd.append("files", file));
      const resp = await fetch(`${API}/requisiciones/${id}/attachments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudieron subir adjuntos");
      }
      setPendingAttachments([]);
      const listResp = await fetch(`${API}/requisiciones/${id}`, { headers: getAuthHeaders() });
      const listData = await listResp.json().catch(() => ({}));
      if (listResp.ok) {
        setAttachments(Array.isArray(listData.attachments) ? listData.attachments : []);
      }
      toast.success("Adjuntos cargados");
    } catch (e) {
      toast.error(e?.message || "Error al subir adjuntos");
    } finally {
      setUploadingAttachments(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const resp = await fetch(`${API}/requisiciones/${id}/attachments/${attachment.id}/download`, {
        headers: getAuthHeaders(),
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.original_name || "adjunto";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar el adjunto");
    }
  };

  const eliminarPartida = (index) => {
    if (!isBorrador) return;
    const key = partidas[index]?.unique_key;
    const copia = [...partidas];
    copia.splice(index, 1);
    setPartidas(copia);
    if (key) {
      setPartidaPhotoDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const actualizarPartida = (index, field, value) => {
    if (!isBorrador) return;
    const copia = [...partidas];
    copia[index][field] = value;
    setPartidas(copia);
  };

  const onPartidaPhotoPick = (uniqueKey, filesRaw) => {
    const file = Array.from(filesRaw || [])[0];
    if (!file || !uniqueKey) return;
    const type = String(file.type || "").toLowerCase();
    const isImage = type.startsWith("image/");
    if (!isImage) {
      toast.warning("Solo se permiten imágenes por partida");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPartidaPhotoDrafts((prev) => {
      const old = prev[uniqueKey];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      return {
        ...prev,
        [uniqueKey]: {
          file,
          previewUrl,
          fromServer: false,
          isLocalFile: true,
        },
      };
    });
  };

  const clearPartidaPhoto = async (partida) => {
    const uniqueKey = partida?.unique_key;
    if (!uniqueKey) return;
    const lineItemId = Number(partida?.id || 0);
    const entry = partidaPhotoDrafts[uniqueKey];

    setPartidaPhotoDrafts((prev) => {
      const old = prev[uniqueKey];
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      const next = { ...prev };
      delete next[uniqueKey];
      return next;
    });

    if (!lineItemId || !entry?.fromServer) return;
    try {
      const resp = await fetch(partidaImageEndpoint(lineItemId), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudo eliminar la imagen");
      }
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar la imagen");
    }
  };

  const uploadPartidaImage = async (lineItemId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(partidaImageEndpoint(lineItemId), {
      method: "POST",
      headers: getAuthHeaders(),
      body: fd,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.ok === false) {
      throw new Error(data?.message || "No se pudo guardar imagen de la partida");
    }
    return data;
  };

  useEffect(() => {
    return () => {
      Object.values(partidaPhotoDrafts).forEach((entry) => {
        if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      });
    };
  }, [partidaPhotoDrafts]);

  const validate = () => {
    if (!requestName.trim()) {
      toast.warning("Falta el nombre");
      return false;
    }
    if (!partidas.length) {
      toast.warning("Sin artículos");
      return false;
    }
    for (let i = 0; i < partidas.length; i++) {
      const p = partidas[i];
      if (!p.product_name?.trim()) {
        toast.warning(`Partida #${i + 1} incompleta`);
        return false;
      }
      if (p.quantity === "" || Number(p.quantity) <= 0) {
        toast.warning(`Cantidad inválida en partida #${i + 1}`);
        return false;
      }
      if (!p.units_id) {
        toast.warning(`Unidad faltante en partida #${i + 1}`);
        return false;
      }
    }
    return true;
  };

  const guardarCambios = async ({ silent = false, navigateOnSuccess = true } = {}) => {
    if (!isBorrador) {
      toast.warning("No editable");
      return false;
    }
    if (saving || sending) return false;
    if (!validate()) return false;

    try {
      setSaving(true);

      const partidasLimpias = partidas.map((partida) => {
        const rest = { ...partida };
        delete rest.unique_key;
        return {
          ...rest,
          quantity: Number(rest.quantity),
          units_id: Number(rest.units_id),
        };
      });

      const resp = await fetch(`${API}/requisiciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

      const savedPartidas = Array.isArray(data?.partidas) ? data.partidas : [];
      if (savedPartidas.length) {
        const prevPartidas = [...partidas];
        const remappedPartidas = savedPartidas.map((sp, idx) => {
          const prev = prevPartidas[idx];
          return {
            ...sp,
            unique_key: sp.id || prev?.unique_key || safeUUID(),
            quantity: sp.quantity ?? "",
            units_id: sp.units_id ?? "",
            product_name: sp.product_name ?? "",
            description: sp.description ?? "",
            image_original_name: sp.image_original_name ?? null,
            image_mime_type: sp.image_mime_type ?? null,
            image_size_bytes: sp.image_size_bytes ?? null,
          };
        });

        const nextDrafts = {};
        remappedPartidas.forEach((rp, idx) => {
          const prevKey = prevPartidas[idx]?.unique_key;
          if (prevKey && partidaPhotoDrafts[prevKey]) {
            nextDrafts[rp.unique_key] = {
              ...partidaPhotoDrafts[prevKey],
              lineItemId: rp.id || null,
            };
          }
        });
        setPartidas(remappedPartidas);
        setPartidaPhotoDrafts(nextDrafts);

        const uploads = remappedPartidas
          .map((rp) => {
            const entry = nextDrafts[rp.unique_key];
            if (!rp.id || !entry?.isLocalFile || !(entry.file instanceof File)) return null;
            return { lineItemId: rp.id, file: entry.file };
          })
          .filter(Boolean);

        if (uploads.length) {
          for (const up of uploads) {
            await uploadPartidaImage(up.lineItemId, up.file);
          }
          await hydratePartidaImages(remappedPartidas);
        }
      }

      if (!silent) {
        toast.success("Cambios guardados. La requisición quedó en borrador.");
      }

      if (navigateOnSuccess) {
        navigate("/unidad/dashboard");
      }

      return true;
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ✅ abre modal
  const pedirConfirmacionEnviar = () => {
    if (!isBorrador) {
      toast.warning("No se puede enviar");
      return;
    }
    if (!validate()) return;
    setConfirmSendOpen(true);
  };

  // ✅ confirma modal
  const guardarYEnviar = async () => {
    if (sending || saving) return;

    setConfirmSendOpen(false);

    const ok = await guardarCambios({ silent: true, navigateOnSuccess: false });
    if (!ok) return;

    try {
      setSending(true);

      const resp = await fetch(`${API}/requisiciones/${id}/enviar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ resume_to: resumeTo }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.message || "No se pudo enviar la requisición");
      }

      toast.success("Requisición enviada");

      setEstatusId(Number(data?.statuses_id || resumeTo));
      navigate("/unidad/mi-requisiciones");
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar");
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
      {/* ✅ Modal Confirmación Enviar */}
      <ConfirmModal
        open={confirmSendOpen}
        loading={sending}
        title={resumeTo === 12 ? "Reenviar a Compras" : resumeTo === 9 ? "Reenviar a Secretaría" : "Enviar a Coordinación"}
        description={
          resumeTo === 12
            ? `¿Deseas reenviar la requisición #${id} a Compras con los ajustes solicitados?`
            : resumeTo === 9
            ? `¿Deseas reenviar la requisición #${id} a Secretaría con los ajustes solicitados?`
            : `¿Deseas enviar la requisición #${id} a Coordinación? Al confirmar, ya no podrás editar el borrador.`
        }
        confirmText="Sí, enviar"
        cancelText="Revisar"
        onCancel={() => setConfirmSendOpen(false)}
        onConfirm={guardarYEnviar}
      />

      <div className="w-full min-h-screen bg-[#F3F4F6] p-6 md:p-10">
        <div className="max-w-[1500px] mx-auto bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

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
              {adjustmentMessage && (
                <div className="text-xs bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="font-bold text-amber-800 uppercase tracking-wide">
                    Ajuste solicitado por {adjustmentSource}
                  </p>
                  <p className="mt-1 text-amber-800">{adjustmentMessage}</p>
                  <p className="mt-1 text-amber-700">
                    Estás editando la misma requisición #{id}, no necesitas capturarla de nuevo.
                  </p>
                </div>
              )}

              <div>
                <Label>Categoría</Label>
                <select className={inputStyle} disabled>
                  <option>{categoryName || "Sin categoría"}</option>
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
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">
                    Esta requisición ya no está en borrador ({currentStatusMeta.label}).
                  </p>
                  <p className="text-xs text-amber-700 mt-1">{currentStatusMeta.detail}</p>
                  <button
                    type="button"
                    onClick={() => navigate(currentStatusMeta.actionPath)}
                    className="mt-2 text-[11px] font-bold text-amber-900 underline hover:opacity-80"
                  >
                    {currentStatusMeta.actionLabel}
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                  Adjuntos de la requisición (opcional)
                </p>

                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {attachments.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => downloadAttachment(a)}
                      className="w-full text-left bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <p className="text-xs font-semibold text-gray-700 truncate">{a.original_name}</p>
                      <p className="text-[11px] text-gray-500">{fmtSize(a.size_bytes)}</p>
                    </button>
                  ))}
                  {!attachments.length && (
                    <p className="text-[11px] text-gray-400">Sin adjuntos cargados.</p>
                  )}
                </div>

                {isBorrador && (
                  <div className="mt-2">
                    <input
                      id="adjuntos-editar-requisicion"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                      multiple
                      onChange={onPickAttachments}
                      className="hidden"
                    />
                    <label
                      htmlFor="adjuntos-editar-requisicion"
                      className="inline-flex text-xs font-semibold px-2.5 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      Seleccionar adjuntos
                    </label>

                    {pendingAttachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {pendingAttachments.map((f, idx) => (
                          <div key={`${f.name}-${idx}`} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                            <span className="truncate text-gray-700">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => removePendingAttachment(idx)}
                              className="text-gray-400 hover:text-red-600 px-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={uploadAttachments}
                      disabled={!pendingAttachments.length || uploadingAttachments}
                      className="mt-2 w-full py-2 text-xs font-bold rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {uploadingAttachments ? "Subiendo..." : "Subir adjuntos"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== PARTIDAS ===== */}
          <div className="w-full lg:w-[560px] xl:w-[620px] bg-[#F9FAFB] flex flex-col border-l border-gray-200 lg:h-[calc(100vh-140px)] overflow-hidden">

            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Partidas de la requisición
              </h3>
              <p className="text-lg font-bold text-gray-800 mt-1">
                Edición de artículos (vista laptop)
              </p>
            </div>

            {/* SCROLL SOLO AQUÍ */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              <AnimatePresence>
                {partidas.map((p, index) => (
                  <Motion.div
                    key={p.unique_key}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-2.5 rounded-lg border border-gray-200 relative"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                      Partida #{index + 1}
                    </p>
                    {isBorrador && (
                      <button
                        onClick={() => eliminarPartida(index)}
                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                        title="Eliminar"
                      >
                        <IconTrash />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-1">
                      <div className="md:col-span-7">
                        <label className="text-[11px] font-semibold text-gray-600">Producto</label>
                        <input
                          className="mt-1 w-full font-semibold border border-gray-300 rounded p-1.5 focus:outline-none focus:border-gray-400"
                          placeholder="Producto"
                          value={p.product_name}
                          disabled={!isBorrador}
                          onChange={(e) =>
                            actualizarPartida(index, "product_name", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-gray-600">Cantidad</label>
                        <input
                          type="number"
                          className="mt-1 w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-gray-400"
                          value={p.quantity}
                          disabled={!isBorrador}
                          onChange={(e) =>
                            actualizarPartida(index, "quantity", e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[11px] font-semibold text-gray-600">Unidad</label>
                        <select
                          className="mt-1 w-full p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-400"
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
                              <option value="1">PZA</option>
                              <option value="2">CJA</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="mt-1">
                      <label className="text-[11px] font-semibold text-gray-600">Descripción / Especificaciones</label>
                      <textarea
                        className="mt-1 w-full p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-gray-400"
                        rows="2"
                        placeholder="Descripción"
                        value={p.description}
                        disabled={!isBorrador}
                        onChange={(e) =>
                          actualizarPartida(index, "description", e.target.value)
                        }
                      />
                    </div>

                    <div className="mt-1 rounded-md border border-dashed border-[#8B1D35]/25 p-1.5 bg-[#8B1D35]/[0.06]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold text-[#6F152B] uppercase tracking-wide">
                            Archivo por partida
                          </p>
                          <p className="text-[11px] text-gray-600">
                            Solo imagen (clic para vista previa).
                          </p>
                        </div>
                        {isBorrador && (
                          <label className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[#8B1D35]/30 bg-white hover:bg-[#8B1D35]/[0.08] text-[#6F152B] cursor-pointer">
                            Seleccionar
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                onPartidaPhotoPick(p.unique_key, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {partidaPhotoDrafts[p.unique_key]?.previewUrl && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                partidaPhotoDrafts[p.unique_key].previewUrl,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            title="Abrir vista previa"
                            className="h-14 w-14 shrink-0 rounded border border-[#8B1D35]/20 shadow-sm overflow-hidden bg-white cursor-pointer"
                          >
                            <img
                              src={partidaPhotoDrafts[p.unique_key].previewUrl}
                              alt="Vista previa de partida"
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-gray-700 truncate">
                              {partidaPhotoDrafts[p.unique_key].file?.name || "Adjunto"}
                            </p>
                            <div className="mt-1 flex items-center gap-1">
                              {isBorrador && (
                                <button
                                  type="button"
                                  onClick={() => clearPartidaPhoto(p)}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-[#8B1D35]/30 bg-white text-[#6F152B] hover:bg-[#8B1D35]/[0.08]"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Motion.div>
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
                  title={
                    resumeTo === 12
                      ? "Reenviar a Compras"
                      : resumeTo === 9
                      ? "Reenviar a Secretaría"
                      : "Enviar a Coordinación"
                  }
                >
                  {sending
                    ? "Enviando..."
                    : resumeTo === 12
                    ? "Guardar y Reenviar a Compras →"
                    : resumeTo === 9
                    ? "Guardar y Reenviar a Secretaría →"
                    : "Guardar y Enviar a Coordinación →"}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
