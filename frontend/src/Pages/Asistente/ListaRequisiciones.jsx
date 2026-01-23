import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ===========================
    CONFIGURACIÓN DE ESTATUS
=========================== */

const STATUS_FLOW = [7, 8, 9, 12, 13, 11];

const STATUS_LABELS = {
    7: "Borrador",
    8: "Coordinación",
    9: "Secretaría",
    12: "Cotización",
    13: "Compra",
    11: "Finalizada",
};

    /* ===========================
        BARRA DE PROGRESO
    =========================== */

    const ProgressBar = ({ statusId }) => {
    const index = STATUS_FLOW.indexOf(statusId);
    if (index === -1) return null;

    return (
        <div className="mt-3">
            <div className="flex justify-between text-xs font-medium text-gray-500">
                {STATUS_FLOW.map((id, i) => (
                <span
                    key={id}
                    className={i <= index ? "text-secundario font-semibold" : ""}
                >
                    {STATUS_LABELS[id]}
                </span>
                ))}
            </div>

            <div className="h-2 bg-gray-300 rounded mt-1">
                <div
                    className="h-2 bg-secundario rounded transition-all"
                    style={{ width: `${((index + 1) / STATUS_FLOW.length) * 100}%` }}
                />
            </div>
        </div>
    );
    };

    /* ===========================
        COMPONENTE PRINCIPAL
    =========================== */

    export default function ListaRequisiciones() {
    const [requisiciones, setRequisiciones] = useState([]);
    const [loading, setLoading] = useState(true);

    /* PAGINACIÓN */
    const [paginaActual, setPaginaActual] = useState(1);
    const POR_PAGINA = 5;

    const navigate = useNavigate();

    /* ===========================
        CARGAR REQUISICIONES
    =========================== */

    useEffect(() => {
        const fetchRequisiciones = async () => {
        try {
            const usuario = JSON.parse(localStorage.getItem("usuario"));
            if (!usuario?.id) return;

            const res = await fetch(
            `http://localhost:4000/api/requisiciones/mis-requisiciones/${usuario.id}`
            );
            const data = await res.json();
            setRequisiciones(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
        };

        fetchRequisiciones();
    }, []);

    /* ===========================
        PAGINACIÓN
    =========================== */

    const totalPaginas = Math.ceil(requisiciones.length / POR_PAGINA);
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const fin = inicio + POR_PAGINA;
    const requisicionesPagina = requisiciones.slice(inicio, fin);

    /* ===========================
        ACCIONES
    =========================== */

    const editar = (id) => navigate(`/unidad/requisiciones/editar/${id}`);

    const enviar = async (id) => {
        const res = await fetch(
        `http://localhost:4000/api/requisiciones/${id}/enviar`,
        { method: "PATCH" }
        );
        const data = await res.json();

        if (data.ok) {
        setRequisiciones(prev =>
            prev.map(r =>
            r.id === id ? { ...r, statuses_id: 8, estatus: "Coordinación" } : r
            )
        );
        }
    };

    if (loading) return <p className="text-gray-500">Cargando...</p>;
    if (!requisiciones.length)
        return <p className="text-gray-500">No hay requisiciones.</p>;

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-secundario">
                Mis requisiciones
            </h2>

            <div className="space-y-5">
                {requisicionesPagina.map(req => (
                <div
                    key={req.id}
                    className="p-5 border rounded-lg bg-gray-50 hover:bg-gray-100 transition shadow-sm"
                >
                    <div className="flex justify-between items-center">
                    <strong className="text-lg text-secundario">
                        {req.categoria}
                    </strong>
                    <span className="text-sm text-gray-600">
                        {req.created_at?.split("T")[0]}
                    </span>
                    </div>

                    <p className="text-sm mt-1">
                    Estatus: <b>{req.estatus}</b>
                    </p>

                    <ProgressBar statusId={req.statuses_id} />

                    {req.statuses_id === 7 && (
                    <div className="flex gap-3 mt-4">
                        <button
                        onClick={() => editar(req.id)}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                        >
                        Editar
                        </button>

                        <button
                        onClick={() => enviar(req.id)}
                        className="px-4 py-2 bg-secundario text-white rounded hover:bg-red-700"
                        >
                        Enviar
                        </button>
                    </div>
                    )}
                </div>
                ))}
            </div>

            {/* ===== CONTROLES DE PAGINACIÓN ===== */}
            <div className="mt-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
                    <button
                        onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                        disabled={paginaActual === 1}
                        className="w-full sm:w-auto px-5 py-2 bg-gray-200 rounded-md text-sm font-semibold
                            hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                    ← Anterior
                    </button>

                    <span className="text-sm text-gray-600 text-center">
                        Página <b>{paginaActual}</b> de <b>{totalPaginas}</b>
                    </span>

                    <button
                        onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                        disabled={paginaActual === totalPaginas}
                        className="w-full sm:w-auto px-5 py-2 bg-gray-200 rounded-md text-sm font-semibold
                                hover:bg-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Siguiente →
                    </button>

                </div>
            </div>
        </div>
    );
}
