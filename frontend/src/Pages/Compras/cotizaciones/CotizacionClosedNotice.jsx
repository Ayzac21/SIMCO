import React from "react";
import { Info } from "lucide-react";

export default function CotizacionClosedNotice({ requisition }) {
    const statusId = Number(requisition?.statuses_id);
    const isReview = statusId === 14;

    return (
        <div className="mb-4">
            <div
                className="
                rounded-xl px-4 py-3 flex gap-3 shadow-sm
                border border-amber-200
                bg-amber-50
                "
            >
                <div
                className="
                    p-2 rounded-lg h-fit
                    bg-white/70
                    border border-amber-200
                    text-amber-700
                "
                >
                <Info size={16} />
                </div>

                <div className="text-xs text-gray-700 leading-relaxed">
                    <div className="font-semibold text-gray-900">
                        {isReview ? "En revisión interna — en espera de selección final" : "Recepción cerrada"}
                    </div>

                    <div className="mt-0.5">
                        {isReview ? (
                        <>
                            La requisición permanece en revisión interna hasta que se confirme la selección final por partida.
                        </>
                        ) : (
                        <>
                            La recepción de cotizaciones ya fue cerrada.
                            {" "}Si necesitas capturar más datos, primero reabre la recepción.
                        </>
                        )}
                        <span className="text-gray-600"> En esta etapa ya no es posible editar ni agregar proveedores.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
