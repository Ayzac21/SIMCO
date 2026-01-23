import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "./PageHeader";

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

export default function EditarRequisicion() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [requestName, setRequestName] = useState("");
  const [justification, setJustification] = useState("");
  const [observation, setObservation] = useState("");
  const [estatusId, setEstatusId] = useState(null);
  const [partidas, setPartidas] = useState([]);

  /* ===== FETCH ===== */
  useEffect(() => {
    const fetchRequisicion = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/requisiciones/${id}`
        );
        const data = await res.json();

        setRequestName(data.request_name || "");
        setJustification(data.justification || "");
        setObservation(data.observation || "");
        setEstatusId(data.statuses_id);

        setPartidas(
          (data.partidas || []).map(p => ({
            ...p,
            unique_key: p.id || crypto.randomUUID(),
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequisicion();
  }, [id]);

  /* ===== ACCIONES ===== */
  const agregarPartida = () => {
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

  const eliminarPartida = index => {
    const copia = [...partidas];
    copia.splice(index, 1);
    setPartidas(copia);
  };

  const actualizarPartida = (index, field, value) => {
    const copia = [...partidas];
    copia[index][field] = value;
    setPartidas(copia);
  };

  const guardarCambios = async () => {
    try {
      const partidasLimpias = partidas.map(({ unique_key, ...rest }) => rest);

      await fetch(`http://localhost:4000/api/requisiciones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_name: requestName,
          justification,
          observation,
          partidas: partidasLimpias,
        }),
      });

      alert("Cambios guardados");
    } catch {
      alert("Error al guardar");
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-500">Cargando...</div>
    );
  }

  /* INPUT NEUTRO */
  const inputStyle =
    "w-full p-2.5 border border-gray-300 rounded-md text-gray-700 bg-white " +
    "focus:outline-none focus:border-gray-400 focus:ring-0 transition";

  return (
    <>
      {/* ===== HEADER (USANDO TU COMPONENTE) ===== */}
      <PageHeader
        title="Editar Requisición"
        subtitle="Modifica los detalles de la solicitud existente"
      />

      <div className="w-full min-h-screen bg-[#F3F4F6] p-6 md:p-10">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

          {/* ===== FORMULARIO ===== */}
          <div className="flex-1 p-8 border-r border-gray-100">
            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-800">
                Datos de la Solicitud
              </h2>
              {estatusId === 7 && (
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
                  onChange={e => setRequestName(e.target.value)}
                />
              </div>

              <div>
                <Label>Justificación</Label>
                <textarea
                  rows="3"
                  className={inputStyle}
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                />
              </div>

              <div>
                <Label>Observaciones</Label>
                <textarea
                  rows="3"
                  className={inputStyle}
                  value={observation}
                  onChange={e => setObservation(e.target.value)}
                />
              </div>
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
                    <button
                      onClick={() => eliminarPartida(index)}
                      className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                    >
                      <IconTrash />
                    </button>

                    <input
                      className="w-full font-semibold border-b border-gray-200 focus:outline-none focus:border-gray-400"
                      placeholder="Producto"
                      value={p.product_name}
                      onChange={e =>
                        actualizarPartida(index, "product_name", e.target.value)
                      }
                    />

                    <textarea
                      className="w-full mt-2 p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-gray-400"
                      rows="2"
                      placeholder="Descripción"
                      value={p.description}
                      onChange={e =>
                        actualizarPartida(index, "description", e.target.value)
                      }
                    />

                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        className="w-1/2 p-2 border border-gray-300 rounded focus:outline-none focus:border-gray-400"
                        value={p.quantity}
                        onChange={e =>
                          actualizarPartida(index, "quantity", e.target.value)
                        }
                      />
                      <select
                        className="w-1/2 p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-400"
                        value={p.units_id}
                        onChange={e =>
                          actualizarPartida(index, "units_id", e.target.value)
                        }
                      >
                        <option value="">U. Medida</option>
                        <option value="1">PZA</option>
                        <option value="2">CJA</option>
                      </select>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                onClick={agregarPartida}
                className="w-full py-3 text-sm font-semibold border border-gray-300 rounded bg-white hover:bg-gray-50"
              >
                + Agregar Artículo
              </button>
            </div>

            <div className="p-6 border-t border-gray-200 bg-white">
              <button
                onClick={guardarCambios}
                className="w-full py-3 bg-principal text-white font-bold rounded shadow hover:opacity-90"
              >
                Confirmar y Guardar Cambios →
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
