import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
// Ya no necesitamos importar PageHeader porque lo integraremos directamente para tener el layout de dos columnas
// import PageHeader from "../../Asistente/PageHeader"; 

export default function CoordinadorLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();

    // --- 1. OBTENER USUARIO LOGUEADO ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    // Helper para obtener el nombre o usar un default
    const userName = user ? (user.name || user.user_name) : "Coordinador";
    const userInitial = userName.charAt(0).toUpperCase();

    /* ===== CONFIG HEADER SEGÚN RUTA ===== */
    const headers = {
        "/coordinador": { // Agregué la ruta base por si acaso
            title: "Dashboard",
            subtitle: "Resumen de actividad"
        },
        "/coordinador/dashboard": {
            title: "Coordinador",
            subtitle: "Revisión y gestión de requisiciones",
        },
        "/coordinador/recibidas": { // Ajusté la ruta a 'recibidas' si usas esa
            title: "Requisiciones recibidas",
            subtitle: "Solicitudes enviadas por las URE",
        },
        // Si tu ruta es /coordinador/requisiciones, usa esta:
        "/coordinador/requisiciones": {
            title: "Requisiciones recibidas",
            subtitle: "Solicitudes enviadas por las URE",
        },
        "/coordinador/requisiciones/nueva": {
            title: "Nueva requisición",
            subtitle: "Crear una requisición como coordinador",
        },
        "/coordinador/revision": {
            title: "Revisión de Solicitud",
            subtitle: "Detalles y aprobación"
        }
    };

    // Si la ruta exacta no existe, buscamos una aproximada o usamos default
    const currentPath = Object.keys(headers).find(path => pathname.startsWith(path) && path !== "/coordinador") || "/coordinador/dashboard";
    const headerInfo = headers[pathname] || headers[currentPath] || { title: "Panel Coordinador", subtitle: "Sistema SIMCO" };

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
                    Coordinador
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavLink
                        to="/coordinador/dashboard"
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        📊 Dashboard
                    </NavLink>

                    {/* Ajusta 'to' según tu ruta real de recibidas */}
                    <NavLink
                        to="/coordinador/requisiciones" 
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        📋 Recibidas
                    </NavLink>

                    <NavLink
                        to="/coordinador/requisiciones/nueva"
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        ➕ Nueva requisición
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-white/20">
                    <button
                        onClick={() => {
                            localStorage.removeItem("usuario");
                            localStorage.removeItem("users_id");
                            window.location.href = "/";
                        }}
                        className="w-full bg-red-800 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* BOTÓN MOBILE (HAMBURGUESA) */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 bg-secundario text-white p-2 rounded-lg shadow-md"
                onClick={() => setOpen(!open)}
            >
                {open ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* ================= CONTENIDO PRINCIPAL ================= */}
            <main className="flex-1 flex flex-col overflow-hidden relative">

                {/* --- NUEVO HEADER INTEGRADO --- */}
                <header className="bg-white border-b border-gray-200 py-5 px-6 md:px-10 shadow-sm flex justify-between items-center sticky top-0 z-30">
                    
                    {/* IZQUIERDA: TÍTULO Y SUBTÍTULO (Dinámicos) */}
                    <div className="ml-10 md:ml-0"> {/* Margin left para no tapar el botón hamburguesa en móvil */}
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                            {headerInfo.title}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500">
                            {headerInfo.subtitle}
                        </p>
                    </div>

                    {/* DERECHA: INFORMACIÓN DEL USUARIO */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-800">Hola, {userName}</p>
                            <p className="text-xs text-gray-500">
                                {user?.ure || "Coordinación"}
                            </p>
                        </div>
                        
                        {/* Círculo con Inicial */}
                        <div className="h-10 w-10 rounded-full bg-secundario text-white flex items-center justify-center font-bold shadow-md text-lg">
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* --- ÁREA DE CONTENIDO (OUTLET) --- */}
                <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 bg-gray-100">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </div>

            </main>
        </div>
    );
}