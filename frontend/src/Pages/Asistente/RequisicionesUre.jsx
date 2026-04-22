import React, { useState, useEffect } from "react";
import { getAuthHeaders } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";

// --- TUS ICONOS ORIGINALES ---
const IconSuccess = () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;
const IconError = () => <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const IconArrowRight = () => <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>;
const IconBack = () => <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>;
const IconTrash = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>;

export default function RequisicionesUre() {

    // --- ESTADOS ---
    const [step, setStep] = useState(1);
    const [categoria, setCategoria] = useState("");
    const [categorias, setCategorias] = useState([]);

    const [nombreReq, setNombreReq] = useState("");
    const [observacion, setObservacion] = useState("");
    const [justificacion, setJustificacion] = useState("");

    const [unidad, setUnidad] = useState("");
    const [unidades, setUnidades] = useState([]);
    const [producto, setProducto] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [especificaciones, setEspecificaciones] = useState("");
    const [partidaFoto, setPartidaFoto] = useState(null);
    const [partidaFotoPreviewUrl, setPartidaFotoPreviewUrl] = useState("");
    const [articulos, setArticulos] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [dragActive, setDragActive] = useState(false);

    const [errors, setErrors] = useState({ 
        nombreReq: false,
        justificacion: false,
        observacion: false,
        producto: false, 
        cantidad: false, 
        unidad: false 
    });

    const [notification, setNotification] = useState({ show: false, message: "", type: "success" });
    const normalizeText = (value) => String(value || "").trim().toLowerCase();

    useEffect(() => {
        if (!(partidaFoto instanceof File)) {
            setPartidaFotoPreviewUrl("");
            return;
        }
        const url = URL.createObjectURL(partidaFoto);
        setPartidaFotoPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [partidaFoto]);

    const fmtSize = (bytes) => {
        const n = Number(bytes || 0);
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    };

    // --- ALERTA ---
    const showAlert = (message, type = "success") => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false }), 3000);
    };

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [catRes, unitRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/categories`, { headers: getAuthHeaders() }),
                    fetch(`${API_BASE_URL}/units`, { headers: getAuthHeaders() }),
                ]);

                
                if (catRes.ok) {
                    const cats = await catRes.json();
                    setCategorias(cats);
                    if (cats.length > 0) setCategoria(String(cats[0].id));
                }
                if (unitRes.ok) {
                    const units = await unitRes.json();
                    const sortedUnits = Array.isArray(units)
                        ? [...units].sort((a, b) =>
                            String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity: "base" })
                        )
                        : [];
                    setUnidades(sortedUnits);
                }
            } catch (err) {
                console.error(err);
                showAlert("Error de conexión", "error");
            }
        };
        fetchInitialData();
    }, []);

    // --- NAVEGACIÓN ---
    const irAlPaso2 = () => {
        const missingNombre = !nombreReq.trim();
        const missingJustificacion = !justificacion.trim();
        const missingObservacion = !observacion.trim();

        if (missingNombre || missingJustificacion || missingObservacion) {
            setErrors(prev => ({
                ...prev,
                nombreReq: missingNombre,
                justificacion: missingJustificacion,
                observacion: missingObservacion,
            }));
            showAlert("Nombre, justificación y observaciones son obligatorios", "error");
            return; 
        }
        setStep(2);
    };

    const volverAlPaso1 = () => setStep(1);

    // --- LÓGICA ARTÍCULOS ---
    const agregarArticulo = () => {
        const newErrors = {
            producto: !producto.trim(),
            cantidad: !cantidad.trim(),
            unidad: !unidad.trim(),
            nombreReq: false
        };
        setErrors(newErrors);

        if (newErrors.producto || newErrors.cantidad || newErrors.unidad) {
            showAlert("Completa los campos marcados", "error");
            return;
        }

        const unidadNombre = unidades.find(u => u.id == unidad)?.name || "";
        const fotoPreviewUrl = partidaFoto instanceof File ? URL.createObjectURL(partidaFoto) : null;
        setArticulos([...articulos, {
            id: Date.now(),
            producto,
            cantidad,
            unidad: unidadNombre,
            units_id: Number(unidad),
            especificaciones,
            foto_partida: partidaFoto instanceof File ? partidaFoto : null,
            foto_preview_url: fotoPreviewUrl,
        }]);

        setProducto(""); setCantidad(""); setUnidad(""); setEspecificaciones(""); setPartidaFoto(null);
        setErrors({ producto: false, cantidad: false, unidad: false, nombreReq: false });
    };

    const eliminarArticulo = (id) => {
        setArticulos((prev) => {
            const current = prev.find((a) => a.id === id);
            if (current?.foto_preview_url) URL.revokeObjectURL(current.foto_preview_url);
            return prev.filter((a) => a.id !== id);
        });
    };
    const eliminarAdjunto = (index) => setAttachments(attachments.filter((_, i) => i !== index));

    const procesarAdjuntos = (filesRaw) => {
        const files = Array.from(filesRaw || []);
        if (!files.length) return;

        const clean = files.filter((f) => {
            const type = String(f.type || "").toLowerCase();
            const name = String(f.name || "").toLowerCase();
            const byMime = type.includes("pdf") || type.startsWith("image/");
            const byExt = [".pdf", ".png", ".jpg", ".jpeg", ".webp"].some((ext) => name.endsWith(ext));
            return byMime || byExt;
        });
        if (clean.length !== files.length) {
            showAlert("Solo se permiten imágenes (PNG/JPG/WEBP) y PDF", "error");
        }

        const merged = [...attachments, ...clean].slice(0, 5);
        if (attachments.length + clean.length > 5) {
            showAlert("Máximo 5 adjuntos por requisición", "error");
        }
        setAttachments(merged);
    };

    const agregarAdjuntos = (e) => {
        procesarAdjuntos(e.target.files);
        e.target.value = "";
    };

    const uploadPartidaImage = async (requisitionId, lineItemId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        const resp = await fetch(`${API_BASE_URL}/requisiciones/${requisitionId}/partidas/${lineItemId}/image`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: fd,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data?.ok === false) {
            throw new Error(data?.message || "No se pudo guardar la foto de la partida");
        }
    };

    // --- ENVIAR ---
    const enviarRequisicion = async () => {
        const user = JSON.parse(localStorage.getItem("usuario"));
        if (!user) { showAlert("Sesión expirada", "error"); return; }
        if (!nombreReq.trim() || !justificacion.trim() || !observacion.trim()) {
            setErrors(prev => ({
                ...prev,
                nombreReq: !nombreReq.trim(),
                justificacion: !justificacion.trim(),
                observacion: !observacion.trim(),
            }));
            showAlert("Completa nombre, justificación y observaciones", "error");
            setStep(1);
            return;
        }

        const articulosPayload = articulos.map(({ foto_partida, ...art }) => art);
        const body = {
            users_id: user.id,
            categoria: Number(categoria),
            area_folio: user.ure,
            request_name: nombreReq,
            justification: justificacion,
            observation: observacion,
            articulos: articulosPayload,
            notes: ""
        };

        try {
            const res = await fetch(`${API_BASE_URL}/requisiciones`, {
                method: "POST", 
                headers: { "Content-Type": "application/json", ...getAuthHeaders() }, 
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                const fotosPendientes = articulos.filter((a) => a.foto_partida instanceof File);
                if (fotosPendientes.length && data.id) {
                    const detailRes = await fetch(`${API_BASE_URL}/requisiciones/${data.id}`, {
                        headers: getAuthHeaders(),
                    });
                    const detailData = await detailRes.json().catch(() => ({}));
                    if (!detailRes.ok) {
                        throw new Error(detailData?.message || "No se pudieron vincular fotos de partidas");
                    }

                    const createdItems = Array.isArray(detailData?.partidas) ? detailData.partidas : [];
                    const usedIndexes = new Set();
                    const uploads = [];

                    fotosPendientes.forEach((art) => {
                        let idx = createdItems.findIndex((item, i) =>
                            !usedIndexes.has(i) &&
                            normalizeText(item.product_name) === normalizeText(art.producto) &&
                            normalizeText(item.description) === normalizeText(art.especificaciones) &&
                            Number(item.quantity || 0) === Number(art.cantidad || 0) &&
                            Number(item.units_id || 0) === Number(art.units_id || 0)
                        );

                        if (idx === -1) {
                            idx = createdItems.findIndex((_, i) => !usedIndexes.has(i));
                        }
                        if (idx === -1) return;

                        usedIndexes.add(idx);
                        uploads.push({
                            lineItemId: createdItems[idx]?.id,
                            file: art.foto_partida,
                        });
                    });

                    for (const up of uploads) {
                        if (!up?.lineItemId || !(up.file instanceof File)) continue;
                        await uploadPartidaImage(data.id, up.lineItemId, up.file);
                    }
                }

                if (attachments.length && data.id) {
                    const fd = new FormData();
                    attachments.forEach((file) => fd.append("files", file));
                    const up = await fetch(`${API_BASE_URL}/requisiciones/${data.id}/attachments`, {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: fd,
                    });
                    const upData = await up.json().catch(() => ({}));
                    if (!up.ok) throw new Error(upData?.message || "No se pudieron subir adjuntos");
                }
                showAlert(
                    `Borrador guardado (${data.folio}). Puedes revisarlo y enviarlo después desde tus requisiciones.`,
                    "success"
                );
                articulos.forEach((a) => {
                    if (a?.foto_preview_url) URL.revokeObjectURL(a.foto_preview_url);
                });
                setArticulos([]); setNombreReq(""); setObservacion(""); setJustificacion("");
                setPartidaFoto(null);
                setAttachments([]);
                setStep(1); 
            } else {
                showAlert(data.message || "Error", "error");
            }
        } catch (err) {
            showAlert(err?.message || "Error de conexión", "error");
        }
    };

    return (
        /* BLOQUEO DE SCROLL GENERAL:
        h-[calc(100vh-80px)]: Altura exacta de la pantalla menos el header.
        overflow-hidden: IMPIDE que la página se mueva.
        */
        <div className="w-full h-[calc(100vh-90px)]  flex justify-center items-center p-4 overflow-hidden">

            {/* NOTIFICACIÓN */}
            {notification.show && (
                <div className={`fixed top-6 right-6 z-[100] flex items-center px-4 py-3 rounded-lg shadow-xl transition-all duration-300 animate-bounce-in ${
                    notification.type === 'success' ? 'bg-secundario' : 'bg-principal'
                } text-white text-sm`}>
                    {notification.type === 'success' ? <IconSuccess /> : <IconError />}
                    <span className="font-medium">{notification.message}</span>
                </div>
            )}

            {/* TARJETA FLOTANTE CENTRAL:
                h-[85vh]: Altura FIJA. No crece ni se encoge.
                flex: Para organizar columnas.
                overflow-hidden: Corta cualquier hijo que intente salirse.
            */}
            <div className="w-full max-w-6xl h-[85vh] bg-white shadow-2xl rounded-xl border border-gray-200 overflow-hidden flex flex-col lg:flex-row">

                {/* ==================== IZQUIERDA (FORMULARIO) ==================== */}
                <div className="flex-1 flex flex-col h-full relative border-r border-gray-100 overflow-hidden">
                    
                    {/* Header Izquierdo (Fijo) */}
                    <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white z-10 flex-none">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {step === 1 ? "Datos de la Solicitud" : "Agregar Artículos (Partidas)"}
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">Paso {step} de 2</p>
                        </div>
                        <div className="flex gap-2">
                            <div className={`h-2 w-8 rounded-full ${step === 1 ? 'bg-principal' : 'bg-gray-200'}`}></div>
                            <div className={`h-2 w-8 rounded-full ${step === 2 ? 'bg-principal' : 'bg-gray-200'}`}></div>
                        </div>
                    </div>

                    {/* Cuerpo del Formulario (Scroll Interno) */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                        
                        {/* --- PASO 1 --- */}
                        {step === 1 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto pt-2">
                                <div>
                                    <label className="font-semibold block mb-2 text-gray-700">Categoría</label>
                                    <select
                                        value={categoria}
                                        onChange={(e) => setCategoria(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100 focus:border-principal transition-all"
                                    >
                                        {categorias.length === 0 ? <option>Cargando...</option> : categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-semibold block mb-2 text-gray-700">Nombre de la Solicitud <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Papelería"
                                        value={nombreReq}
                                        onChange={(e) => {
                                            setNombreReq(e.target.value);
                                            if (errors.nombreReq) setErrors({...errors, nombreReq: false});
                                        }}
                                        className={`w-full p-3 border rounded-lg outline-none focus:ring-2 transition-all ${
                                            errors.nombreReq 
                                            ? 'border-red-500 bg-red-50 focus:ring-red-200' 
                                            : 'border-gray-300 focus:ring-red-100 focus:border-principal'
                                        }`}
                                    />
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="font-semibold block mb-2 text-gray-700">Justificación <span className="text-red-500">*</span></label>
                                        <textarea
                                            placeholder="Describe por qué necesitas esta compra y qué problema resuelve en tu área."
                                            value={justificacion}
                                            onChange={(e) => {
                                                setJustificacion(e.target.value);
                                                if (errors.justificacion) setErrors(prev => ({ ...prev, justificacion: false }));
                                            }}
                                            className={`w-full p-3 border rounded-lg outline-none focus:ring-2 transition-all h-24 resize-none ${
                                                errors.justificacion
                                                    ? 'border-red-500 bg-red-50 focus:ring-red-200'
                                                    : 'border-gray-300 focus:ring-red-100 focus:border-principal'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="font-semibold block mb-2 text-gray-700">Observaciones <span className="text-red-500">*</span></label>
                                        <textarea
                                            placeholder="Agrega detalles clave: fecha requerida, lugar de entrega y condiciones importantes."
                                            value={observacion}
                                            onChange={(e) => {
                                                setObservacion(e.target.value);
                                                if (errors.observacion) setErrors(prev => ({ ...prev, observacion: false }));
                                            }}
                                            className={`w-full p-3 border rounded-lg outline-none focus:ring-2 transition-all h-24 resize-none ${
                                                errors.observacion
                                                    ? 'border-red-500 bg-red-50 focus:ring-red-200'
                                                    : 'border-gray-300 focus:ring-red-100 focus:border-principal'
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- PASO 2 --- */}
                        {step === 2 && (
                            <div className="animate-fade-in h-full flex flex-col pt-2">
                                <button onClick={volverAlPaso1} className="mb-6 flex items-center text-sm text-gray-500 hover:text-principal transition-colors font-semibold self-start">
                                    <IconBack /> Editar Datos Generales
                                </button>

                                <div className="max-w-3xl w-full mx-auto space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                        <div className="md:col-span-12">
                                            <label className="font-semibold block mb-2 text-gray-700">Nombre del Producto</label>
                                            <input
                                                type="text" placeholder="Descripción..." value={producto} onChange={(e) => setProducto(e.target.value)}
                                                className={`w-full p-3 border rounded-lg outline-none focus:ring-2 transition-all ${errors.producto ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-gray-300 focus:ring-red-100 focus:border-principal'}`}
                                            />
                                        </div>
                                        <div className="md:col-span-6">
                                            <label className="font-semibold block mb-2 text-gray-700">Cantidad</label>
                                            <input
                                                type="number" placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                                                className={`w-full p-3 border rounded-lg outline-none focus:ring-2 transition-all ${errors.cantidad ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-gray-300 focus:ring-red-100 focus:border-principal'}`}
                                            />
                                        </div>
                                        <div className="md:col-span-6">
                                            <label className="font-semibold block mb-2 text-gray-700">Unidad</label>
                                            <select
                                                value={unidad} onChange={(e) => setUnidad(e.target.value)}
                                                className={`w-full p-3 border rounded-lg outline-none bg-white focus:ring-2 transition-all ${errors.unidad ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-gray-300 focus:ring-red-100 focus:border-principal'}`}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {unidades.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-12">
                                            <label className="font-semibold block mb-2 text-gray-700">Especificaciones (Opcional)</label>
                                            <textarea
                                                placeholder="Detalles..." value={especificaciones} onChange={(e) => setEspecificaciones(e.target.value)}
                                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100 focus:border-principal transition-all h-24 resize-none"
                                            />
                                        </div>
                                        <div className="md:col-span-12">
                                            <label className="font-semibold block mb-2 text-gray-700">Foto de referencia de la partida (Opcional)</label>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                                onChange={(e) => setPartidaFoto(e.target.files?.[0] || null)}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-red-100 focus:border-principal transition-all text-sm"
                                            />
                                            <p className="text-[11px] text-gray-500 mt-1">
                                                Solo imágenes (PNG/JPG/WEBP).
                                                {partidaFoto ? ` Seleccionada: ${partidaFoto.name}` : ""}
                                            </p>
                                            {partidaFotoPreviewUrl && (
                                                <div className="mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(partidaFotoPreviewUrl, "_blank", "noopener,noreferrer")}
                                                        className="h-16 w-16 rounded border border-[#8B1D35]/20 shadow-sm overflow-hidden bg-white"
                                                        title="Abrir vista previa"
                                                    >
                                                        <img
                                                            src={partidaFotoPreviewUrl}
                                                            alt="Vista previa de foto de partida"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={agregarArticulo} className="w-full bg-principal text-white py-3 rounded-lg font-bold hover:opacity-90 transition-all shadow-md mt-4">
                                        + Agregar a la lista
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Izquierdo (Fijo) */}
                    {step === 1 && (
                        <div className="p-6 border-t border-gray-50 bg-white flex-none">
                            <button onClick={irAlPaso2} className="w-full max-w-lg mx-auto block bg-secundario text-white py-3.5 rounded-lg font-bold hover:opacity-90 transition-all flex items-center justify-center text-base shadow-sm">
                                Continuar <IconArrowRight />
                            </button>
                        </div>
                    )}
                </div>

                {/* ==================== DERECHA (RESUMEN FIJO) ==================== */}
                {/* h-full: Ocupa toda la altura del padre.
                    flex flex-col: Estructura vertical.
                    overflow-hidden: Corta lo que sobre.
                */}
                <div className="w-full lg:w-[350px] bg-gray-50 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200 h-auto lg:h-full overflow-hidden">
                    
                    {/* Header Resumen (Fijo) */}
                    <div className="p-6 border-b border-gray-200 bg-white flex-none">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Resumen de Requisición</h2>
                        <div className="mt-3">
                            <p className="font-bold text-gray-800 text-lg truncate leading-tight">
                                {nombreReq || "Nueva Solicitud"}
                            </p>
                        </div>
                    </div>

                    {/* LISTA CON SCROLL INTERNO (Aquí está la magia)
                        flex-1: Toma el espacio disponible entre header y footer.
                        overflow-y-auto: Si hay muchos items, el scroll sale AQUÍ, no en la página.
                        min-h-0: Truco de CSS para que el scroll funcione bien en flexbox anidados.
                    */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar min-h-0">
                        {articulos.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-2 opacity-70 min-h-[200px]">
                                <p className="text-sm font-medium">Lista vacía</p>
                                <p className="text-xs">Agrega artículos para verlos aquí</p>
                            </div>
                        ) : (
                            articulos.map(a => (
                                <div key={a.id} className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex justify-between group hover:shadow-md transition-all">
                                    <div className="pr-2 min-w-0">
                                        <p className="font-bold text-gray-800 text-sm truncate">{a.producto}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-semibold">
                                                {a.cantidad} {a.unidad}
                                            </span>
                                        </div>
                                        {a.especificaciones && <p className="text-xs text-gray-500 mt-2 italic border-l-2 border-principal pl-2 line-clamp-2">"{a.especificaciones}"</p>}
                                        {a.foto_partida && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <p className="text-[11px] text-emerald-700 font-semibold">Con foto de referencia</p>
                                                {a.foto_preview_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(a.foto_preview_url, "_blank", "noopener,noreferrer")}
                                                        className="h-10 w-10 rounded border border-[#8B1D35]/20 overflow-hidden bg-white"
                                                        title="Abrir vista previa"
                                                    >
                                                        <img
                                                            src={a.foto_preview_url}
                                                            alt="Vista previa de foto por partida"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => eliminarArticulo(a.id)} className="text-gray-300 hover:text-red-600 transition-colors p-1 self-start">
                                        <IconTrash />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Resumen (Fijo) */}
                    <div className="p-6 border-t border-gray-200 bg-white flex-none space-y-3">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                Adjuntos (imagen o PDF)
                            </p>
                            <input
                                id="adjuntos-requisicion"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                                multiple
                                onChange={agregarAdjuntos}
                                className="hidden"
                            />
                            <label
                                htmlFor="adjuntos-requisicion"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragActive(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    setDragActive(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragActive(false);
                                    procesarAdjuntos(e.dataTransfer.files);
                                }}
                                className={`block w-full rounded-lg border-2 border-dashed p-3 text-center cursor-pointer transition-all ${
                                    dragActive
                                        ? "border-secundario bg-red-50"
                                        : "border-gray-300 bg-white hover:bg-gray-50"
                                }`}
                            >
                                <p className="text-xs font-semibold text-gray-700">
                                    Haz clic para seleccionar archivos
                                </p>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    o arrástralos aquí (imagen o PDF)
                                </p>
                            </label>
                            <p className="text-[11px] text-gray-500 mt-1">
                                Máximo 5 archivos. Úsalos como referencia visual o cotización de ejemplo.
                            </p>

                            {attachments.length > 0 && (
                                <div className="mt-2 max-h-24 overflow-y-auto space-y-1 pr-1">
                                    {attachments.map((f, i) => (
                                        <div key={`${f.name}-${i}`} className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1 text-xs">
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-gray-700">{f.name}</p>
                                                <p className="text-gray-500">{fmtSize(f.size)}</p>
                                            </div>
                                            <button
                                                onClick={() => eliminarAdjunto(i)}
                                                className="text-gray-400 hover:text-red-600 px-2"
                                                title="Quitar"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={enviarRequisicion}
                            disabled={articulos.length === 0 || step === 1}
                            className={`w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${
                                articulos.length > 0 && step === 2
                                ? "bg-principal text-white hover:opacity-90 shadow-lg transform active:scale-95" 
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            Guardar borrador
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
