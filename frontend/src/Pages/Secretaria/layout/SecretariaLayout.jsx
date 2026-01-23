import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

export default function SecretariaLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();

    // --- 1. OBTENER USUARIO LOGUEADO ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    
    // Helper para obtener el nombre o usar un default
    const userName = user ? (user.name || user.user_name) : "Secretaría";
    const userInitial = userName.charAt(0).toUpperCase();

    /* ===== CONFIG HEADER SEGÚN RUTA (Adaptado para Secretaría) ===== */
    const headers = {
        "/secretaria": { 
            title: "Dashboard",
            subtitle: "Resumen de actividad"
        },
        "/secretaria/dashboard": {
            title: "Secretaría Administrativa",
            subtitle: "Validación de presupuesto y control",
        },
        // Puedes agregar más rutas aquí en el futuro si la Secretaría tiene historial, etc.
    };

    // Si la ruta exacta no existe, buscamos una aproximada o usamos default
    const currentPath = Object.keys(headers).find(path => pathname.startsWith(path) && path !== "/secretaria") || "/secretaria/dashboard";
    const headerInfo = headers[pathname] || headers[currentPath] || { title: "Panel Administrativo", subtitle: "Sistema SIMCO" };

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
                {/* TÍTULO DEL SIDEBAR */}
                <div className="p-6 text-center text-2xl font-bold border-b border-white/20">
                    Secretaría
                </div>

                {/* MENÚ DE NAVEGACIÓN */}
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink
                        to="/secretaria/dashboard"
                        className={({ isActive }) =>
                            `flex items-center gap-2 py-2 px-4 rounded transition
                            ${isActive
                                ? "bg-white text-secundario font-semibold"
                                : "hover:bg-white/20"}`
                        }
                    >
                        📊 Dashboard
                    </NavLink>
                    
                    {/* Aquí puedes agregar más links en el futuro si la secretaría necesita ver historial */}
                </nav>

                {/* BOTÓN CERRAR SESIÓN */}
                <div className="p-4 border-t border-white/20">
                    <button
                        onClick={() => {
                            localStorage.clear();
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

                {/* --- HEADER INTEGRADO (Igual al Coordinador) --- */}
                <header className="bg-white border-b border-gray-200 py-5 px-6 md:px-10 shadow-sm flex justify-between items-center sticky top-0 z-30">
                    
                    {/* IZQUIERDA: TÍTULO Y SUBTÍTULO (Dinámicos) */}
                    <div className="ml-10 md:ml-0"> 
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
                                {user?.ure || "Administración"}
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