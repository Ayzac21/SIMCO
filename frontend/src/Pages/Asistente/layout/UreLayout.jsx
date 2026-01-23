import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import PageHeader from "../PageHeader";

export default function UreLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();

    /* ===== CONFIG HEADER SEGÚN RUTA ===== */
    const headers = {
        "/unidad/dashboard": {
            title: "Panel General",
            subtitle: "Listado de todas tus solicitudes",
        },
        "/unidad/mi-requisiciones": {
            title: "Mis Requisiciones",
            subtitle: "Historial de solicitudes enviadas",
        },
        "/unidad/requisiciones/nueva": {
            title: "Nueva Requisición",
            subtitle: "Crear una solicitud nueva",
        },
    };

    const headerInfo = headers[pathname];

    return (
        <div className="flex h-screen w-full overflow-hidden bg-gray-100">

            {/* ================= SIDEBAR ================= */}
            <aside
                className={`
                    bg-secundario text-white w-64 flex flex-col
                    fixed md:static inset-y-0 z-40
                    transform transition-transform duration-300
                    ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                <div className="p-6 text-center text-2xl font-bold border-b border-white/20">
                    Asistente Panel
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavLink
                        to="/unidad/dashboard"
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        📊 Dashboard
                    </NavLink>

                    <NavLink
                        to="/unidad/mi-requisiciones"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        📋 Mis Requisiciones
                    </NavLink>

                    <NavLink
                        to="/unidad/requisiciones/nueva"
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        ➕ Nueva Requisición
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-white/20">
                    <button
                        onClick={() => {
                            localStorage.removeItem("usuario");
                            window.location.href = "/";
                        }}
                        className="w-full bg-red-800 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* BOTÓN MOBILE */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 bg-secundario text-white p-2 rounded-lg shadow-md"
                onClick={() => setOpen(!open)}
            >
                {open ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* ================= CONTENIDO ================= */}
            <main className="flex-1 flex flex-col overflow-hidden">

                {/* HEADER (STICKY, NO SE MUEVE) */}
                {headerInfo && (
                    <PageHeader
                        title={headerInfo.title}
                        subtitle={headerInfo.subtitle}
                    />
                )}

                {/* CONTENIDO CON SCROLL */}
                <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 animate-fade-in">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>

            </main>
        </div>
    );
}
