import React, { useState, useEffect } from "react";

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
    const [articulos, setArticulos] = useState([]);

    const [errors, setErrors] = useState({ 
        nombreReq: false,
        producto: false, 
        cantidad: false, 
        unidad: false 
    });

    const [notification, setNotification] = useState({ show: false, message: "", type: "success" });

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
                    fetch("http://localhost:4000/api/categories"),
                    fetch("http://localhost:4000/api/units"),
                ]);

                
                if (catRes.ok) {
                    const cats = await catRes.json();
                    setCategorias(cats);
                    if (cats.length > 0) setCategoria(String(cats[0].id));
                }
                if (unitRes.ok) setUnidades(await unitRes.json());
            } catch (err) {
                console.error(err);
                showAlert("Error de conexión", "error");
            }
        };
        fetchInitialData();
    }, []);

    // --- NAVEGACIÓN ---
    const irAlPaso2 = () => {
        if (!nombreReq.trim()) { 
            setErrors(prev => ({ ...prev, nombreReq: true }));
            showAlert("El nombre es obligatorio", "error"); 
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
        setArticulos([...articulos, {
            id: Date.now(), producto, cantidad, unidad: unidadNombre, units_id: Number(unidad), especificaciones
        }]);

        setProducto(""); setCantidad(""); setUnidad(""); setEspecificaciones("");
        setErrors({ producto: false, cantidad: false, unidad: false, nombreReq: false });
    };

    const eliminarArticulo = (id) => setArticulos(articulos.filter(a => a.id !== id));

    // --- ENVIAR ---
    const enviarRequisicion = async () => {
        const user = JSON.parse(localStorage.getItem("usuario"));
        if (!user) { showAlert("Sesión expirada", "error"); return; }

        const body = {
            users_id: user.id,
            categoria: Number(categoria),
            area_folio: user.ure,
            request_name: nombreReq,
            justification: justificacion,
            observation: observacion,
            articulos,
            notes: ""
        };

        try {
            const res = await fetch("http://localhost:4000/api/requisiciones", {
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (res.ok && data.ok) {
                showAlert(`Enviada: ${data.folio}`, "success");
                setArticulos([]); setNombreReq(""); setObservacion(""); setJustificacion("");
                setStep(1); 
            } else {
                showAlert(data.message || "Error", "error");
            }
        } catch (err) { showAlert("Error de conexión", "error"); }
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
                    notification.type === 'success' ? 'bg-green-600' : 'bg-principal'
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
                                        <label className="font-semibold block mb-2 text-gray-700">Justificación</label>
                                        <textarea
                                            value={justificacion}
                                            onChange={(e) => setJustificacion(e.target.value)}
                                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100 focus:border-principal transition-all h-24 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-semibold block mb-2 text-gray-700">Observaciones</label>
                                        <textarea
                                            value={observacion}
                                            onChange={(e) => setObservacion(e.target.value)}
                                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100 focus:border-principal transition-all h-24 resize-none"
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
                                    </div>
                                    <button onClick={() => eliminarArticulo(a.id)} className="text-gray-300 hover:text-red-600 transition-colors p-1 self-start">
                                        <IconTrash />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Resumen (Fijo) */}
                    <div className="p-6 border-t border-gray-200 bg-white flex-none">
                        <button
                            onClick={enviarRequisicion}
                            disabled={articulos.length === 0 || step === 1}
                            className={`w-full py-3.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-all ${
                                articulos.length > 0 && step === 2
                                ? "bg-principal text-white hover:opacity-90 shadow-lg transform active:scale-95" 
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            Confirmar y Enviar
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}