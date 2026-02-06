import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LayoutGrid, LogOut, FileText } from "lucide-react";
import { Toaster } from 'sonner';

export default function SecretariaLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const navigate = useNavigate();

    // --- 1. OBTENER USUARIO LOGUEADO ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const userName = user ? (user.name || user.user_name) : "Secretaría";
    const userInitial = userName.charAt(0).toUpperCase();

    /* ===== CONFIG HEADER SEGÚN RUTA ===== */
    const headers = {
        "/secretaria": {
            title: "Panel Administrativo",
            subtitle: "Gestión financiera"
        },
        "/secretaria/dashboard": {
            title: "Requisiciones por Autorizar",
            subtitle: "Validación de presupuesto y suficiencia",
        },
        "/secretaria/recibidas": {
            title: "Historial de Solicitudes",
            subtitle: "Consulta de requisiciones pasadas",
        }
    };

    // Buscamos la cabecera correspondiente
    const currentPath = Object.keys(headers).find(path => pathname.startsWith(path) && path !== "/secretaria") || "/secretaria/dashboard";
    const headerInfo = headers[pathname] || headers[currentPath] || { title: "Panel Secretaría", subtitle: "Sistema SIMCO" };

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-gray-100 font-sans">
            <Toaster position="top-right" richColors />

            {/* ================= SIDEBAR ================= */}
            <aside
                className={`
                    bg-secundario text-white w-64 flex flex-col
                    fixed md:static inset-y-0 z-40
                    transform transition-transform duration-300 shadow-xl
                    ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                {/* Logo / Título Sidebar */}
                <div className="h-16 flex items-center justify-center border-b border-white/20">
                    <span className="text-xl font-bold tracking-wide">Secretaría</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {/* DASHBOARD */}
                    <NavLink
                        to="/secretaria/dashboard"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                            ${isActive
                                ? "bg-white text-secundario font-bold shadow-md"
                                : "text-white/80 hover:bg-white/20 hover:text-white"}`
                        }
                    >
                        <LayoutGrid size={20} />
                        Dashboard
                    </NavLink>

                    {/* HISTORIAL */}
                    <NavLink
                        to="/secretaria/recibidas"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                            ${isActive
                                ? "bg-white text-secundario font-bold shadow-md"
                                : "text-white/80 hover:bg-white/20 hover:text-white"}`
                        }
                    >
                        <FileText size={20} />
                        Historial
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-white/20">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-red-800 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition shadow-lg text-sm"
                    >
                        <LogOut size={18} /> Cerrar Sesión
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

                {/* --- HEADER INTEGRADO --- */}
                <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-8 shadow-sm flex justify-between items-center sticky top-0 z-30 h-16">
                    
                    {/* IZQUIERDA: TÍTULO Y SUBTÍTULO */}
                    <div className="ml-10 md:ml-0"> 
                        <h1 className="text-lg md:text-xl font-bold text-gray-800">
                            {headerInfo.title}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500">
                            {headerInfo.subtitle}
                        </p>
                    </div>

                    {/* DERECHA: INFORMACIÓN DEL USUARIO */}
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-800 uppercase">{userName}</p>
                            <p className="text-[10px] text-gray-500">Administración</p>
                        </div>
                        
                        {/* Círculo con Inicial (Usa bg-secundario) */}
                        <div className="h-9 w-9 rounded-full bg-secundario text-white flex items-center justify-center font-bold shadow-sm border border-gray-100 text-sm">
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* --- ÁREA DE CONTENIDO (OUTLET) --- */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F3F4F6]">
                    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                        <Outlet />
                    </div>
                </div>

            </main>
        </div>
    );
}