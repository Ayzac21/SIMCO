import React from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("usuario"));

    const handleLogout = () => {
        localStorage.removeItem("usuario");
        navigate("/login");
    };

    if (!user) {
        navigate("/login");
        return null;
    }

    return (
        <div className="flex min-h-screen bg-gray-100">
            <div className="w-64 bg-secundario text-white flex flex-col justify-between">
                <div>
                    <div className="p-6 text-2xl font-bold border-b border-red-500">
                        SIMIC
                    </div>
                    <nav className="flex flex-col mt-4 space-y-2 px-4">
                        <button className="text-left px-3 py-2 rounded-lg hover:bg-principal transition">
                            🏠 Inicio
                        </button>
                        <button className="text-left px-3 py-2 rounded-lg hover:bg-principal transition">
                            📊 Monitoreo
                        </button>
                        <button className="text-left px-3 py-2 rounded-lg hover:bg-principal transition">
                            🛒 Compras
                        </button>
                        <button className="text-left px-3 py-2 rounded-lg hover:bg-principal transition">
                            📦 Inventario
                        </button>
                    </nav>
                </div>
                <div className="p-4 border-t border-red-500">
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-800 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 p-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    Bienvenido, {user.nombre}
                </h1>
                <p className="text-gray-600 mb-8">
                    Has iniciado sesión correctamente. Aquí podrás gestionar el sistema SIMIC.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition">
                        <h2 className="text-xl font-semibold text-principal mb-2">Monitoreo</h2>
                        <p className="text-gray-500 text-sm mb-4">
                            Reportes y control de aulas.
                        </p>
                        <button className="bg-principal text-white py-2 px-4 rounded-lg hover:bg-red-700 transition">
                            Ir
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition">
                        <h2 className="text-xl font-semibold text-principal mb-2">Compras</h2>
                        <p className="text-gray-500 text-sm mb-4">
                            Gestión de proveedores y cotizaciones.
                        </p>
                        <button className="bg-principal text-white py-2 px-4 rounded-lg hover:bg-red-700 transition">
                            Ir
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-xl transition">
                        <h2 className="text-xl font-semibold text-principal mb-2">Inventario</h2>
                        <p className="text-gray-500 text-sm mb-4">
                            Control y seguimiento de equipos.
                        </p>
                        <button className="bg-principal text-white py-2 px-4 rounded-lg hover:bg-red-700 transition">
                            Ir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
