import React from "react";
import { BarChart3, CheckCircle, XCircle } from "lucide-react";
import PageHeader from "./pAGEhEADER.JSX";

export default function UreDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-principal">Panel General</h1>
                <p className="text-gray-700 mt-2">
                    Bienvenido al sistema de requisiciones. Aquí podrás gestionar tus solicitudes,
                    ver su estado actual y crear nuevas requisiciones.
                </p>
            </div>

            {/* Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
                    <div className="bg-principal/10 p-3 rounded-lg">
                        <BarChart3 size={28} className="text-principal" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-principal">Pendientes</h2>
                        <p className="text-4xl font-bold text-gray-700 leading-tight">8</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                        <CheckCircle size={28} className="text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-green-600">Aprobadas</h2>
                        <p className="text-4xl font-bold text-green-600 leading-tight">5</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-lg">
                        <XCircle size={28} className="text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-red-600">Rechazadas</h2>
                        <p className="text-4xl font-bold text-red-600 leading-tight">2</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
