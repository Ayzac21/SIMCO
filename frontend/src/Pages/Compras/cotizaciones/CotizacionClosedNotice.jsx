import React from "react";
import { Info } from "lucide-react";

export default function CotizacionClosedNotice({ requisition }) {
    const solicitante =
        requisition?.solicitante ||
        requisition?.solicitante_name ||
        requisition?.user_name ||
        "el solicitante";

    return (
        <div className="mb-4">
            <div
                className="
                rounded-xl px-4 py-3 flex gap-3 shadow-sm
                border border-[#8B1D35]/15
                bg-[#8B1D35]/5
                "
            >
                <div
                className="
                    p-2 rounded-lg h-fit
                    bg-white/70
                    border border-[#8B1D35]/15
                    text-[#8B1D35]
                "
                >
                <Info size={16} />
                </div>

                <div className="text-xs text-gray-700 leading-relaxed">
                    <div className="font-semibold text-gray-900">
                        Recepción finalizada — en espera de selección
                    </div>

                    <div className="mt-0.5">
                        Esta cotización está en espera de que{" "}
                        <span className="font-semibold">{solicitante}</span> seleccione la
                        mejor opción.{" "}
                        <span className="text-gray-600">
                        Compras ya no puede editar ni agregar proveedores.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
