import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import PageHeader from "../PageHeader";
import escudoCualtos from "../../../assets/escudo-cualtos-02_0_1.png";

export default function UreLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const userName = user ? (user.name || user.user_name || "Asistente") : "Asistente";
    const userInitial = (userName?.[0] || "A").toUpperCase();

    /* ===== CONFIG HEADER SEGÚN RUTA ===== */
    const headers = useMemo(
        () => ({
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
        "/unidad/requisiciones/editar": {
            title: "Editar Requisición",
            subtitle: "Modifica los detalles de la solicitud existente",
        },

        // ✅ NUEVO (ruta dinámica)
        "/unidad/requisiciones/revision": {
            title: "Revisión de cotización",
            subtitle: "Compara opciones y elige por partida",
        },
        }),
        []
    );

    // ✅ Soporta rutas con :id (startsWith)
    const headerInfo =
        headers[pathname] ||
        (pathname.startsWith("/unidad/requisiciones/editar/")
        ? headers["/unidad/requisiciones/editar"]
        : null) ||
        (pathname.startsWith("/unidad/requisiciones/revision")
        ? headers["/unidad/requisiciones/revision"]
        : null);

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
            <div className="p-4 border-b border-white/20">
            <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <div className="flex items-center gap-3">
                <div className="h-9 w-9 aspect-square shrink-0 rounded-full bg-white text-secundario font-bold flex items-center justify-center">
                    {userInitial}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className="text-[11px] text-white/80 truncate">{user?.ure || "Unidad Responsable"}</p>
                </div>
                </div>
            </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
            <NavLink
                to="/unidad/dashboard"
                className={({ isActive }) =>
                `flex items-center gap-2 py-2 px-4 rounded transition
                ${
                    isActive
                    ? "bg-white text-secundario font-semibold"
                    : "hover:bg-white/20"
                }`
                }
                onClick={() => setOpen(false)}
            >
                📊 Dashboard
            </NavLink>

            <NavLink
                to="/unidad/mi-requisiciones"
                end
                className={({ isActive }) =>
                `flex items-center gap-2 py-2 px-4 rounded transition
                ${
                    isActive
                    ? "bg-white text-secundario font-semibold"
                    : "hover:bg-white/20"
                }`
                }
                onClick={() => setOpen(false)}
            >
                📋 Mis Requisiciones
            </NavLink>

            <NavLink
                to="/unidad/requisiciones/nueva"
                className={({ isActive }) =>
                `flex items-center gap-2 py-2 px-4 rounded transition
                ${
                    isActive
                    ? "bg-white text-secundario font-semibold"
                    : "hover:bg-white/20"
                }`
                }
                onClick={() => setOpen(false)}
            >
                ➕ Nueva Requisición
            </NavLink>
            </nav>

            <div className="p-2 border-t border-white/20 relative overflow-hidden">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 h-24 w-24 rounded-full bg-white/20 blur-2xl pointer-events-none"></div>
            <div className="absolute right-0 -top-6 h-20 w-20 rounded-full bg-white/15 blur-2xl pointer-events-none"></div>
            <img
                src={escudoCualtos}
                alt="Escudo institucional UDG CUAltos"
                className="relative z-10 block w-full h-auto object-contain"
            />
            </div>
        </aside>

        {/* BOTÓN MOBILE */}
        <button
            className="md:hidden fixed top-4 left-4 z-50 bg-secundario text-white p-2 rounded-lg shadow-md"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
            {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* ================= CONTENIDO ================= */}
        <main className="flex-1 flex flex-col overflow-hidden">
            {/* HEADER */}
            {headerInfo && (
            <PageHeader title={headerInfo.title} subtitle={headerInfo.subtitle} />
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
