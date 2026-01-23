import React from "react";

export default function UreDashboardUre() {
    return (
        <div>
            <h1 className="text-3xl font-bold text-principal mb-6">Panel General</h1>
            <p className="text-gray-700">
                Bienvenido al sistema de requisiciones. Aquí podrás gestionar tus solicitudes,
                ver su estado actual y crear nuevas requisiciones.
            </p>

            <div className="grid grid-cols-3 gap-6 mt-10">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold text-principal">Pendientes</h2>
                    <p className="text-4xl font-bold text-gray-700 mt-3">8</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-semibold text-principal">Aprobadas</h2>
                        <p className="text-4xl font-bold text-green-600 mt-3">5</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold text-principal">Rechazadas</h2>
                    <p className="text-4xl font-bold text-red-600 mt-3">2</p>
                </div>
            </div>
        </div>
    );
}
