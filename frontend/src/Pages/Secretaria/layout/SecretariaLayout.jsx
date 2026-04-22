import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LayoutGrid, FileText, PlusCircle } from "lucide-react";
import { Toaster } from 'sonner';
import NotificationBell from "../../../components/NotificationBell";
import escudoCualtos from "../../../assets/escudo-cualtos-02_0_1.png";
import UserMenu from "../../../components/UserMenu";
import { getUserUnitLabel } from "../../../utils/unitDisplay";

export default function SecretariaLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const navigate = useNavigate();

    // --- 1. OBTENER USUARIO LOGUEADO ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const userName = user ? (user.name || user.user_name) : "Secretaría";
    const userInitial = userName.charAt(0).toUpperCase();
    const userUnitLabel = getUserUnitLabel(user, "Secretaría");

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
        "/secretaria/mi-requisiciones": {
            title: "Mis Requisiciones",
            subtitle: "Borradores y seguimiento de tus solicitudes",
        },
        "/secretaria/recibidas": {
            title: "Historial de Solicitudes",
            subtitle: "Consulta de requisiciones pasadas",
        },
        "/secretaria/requisiciones/nueva": {
            title: "Nueva Requisición",
            subtitle: "Crear una solicitud desde Secretaría",
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
                <div className="p-4 border-b border-white/20">
                    <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 aspect-square shrink-0 rounded-full bg-white text-secundario font-bold flex items-center justify-center">
                                {userInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{userName}</p>
                                <p className="text-[11px] text-white/80 truncate">{userUnitLabel}</p>
                            </div>
                        </div>
                    </div>
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
                        to="/secretaria/mi-requisiciones"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                            ${isActive
                                ? "bg-white text-secundario font-bold shadow-md"
                                : "text-white/80 hover:bg-white/20 hover:text-white"}`
                        }
                    >
                        <FileText size={20} />
                        Mis requisiciones
                    </NavLink>

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

                    <NavLink
                        to="/secretaria/requisiciones/nueva"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                            ${isActive
                                ? "bg-white text-secundario font-bold shadow-md"
                                : "text-white/80 hover:bg-white/20 hover:text-white"}`
                        }
                    >
                        <PlusCircle size={20} />
                        Nueva Requisición
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
                        <NotificationBell />
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-800">Bienvenido, {userName}</p>
                            <p className="text-[10px] text-gray-500">Administración</p>
                        </div>
                        
                            <UserMenu
                            userName={userName}
                            userInitial={userInitial}
                            subtitle={userUnitLabel}
                            onLogout={handleLogout}
                            avatarClassName="h-9 w-9 aspect-square shrink-0 rounded-full bg-secundario text-white flex items-center justify-center font-bold shadow-sm border border-gray-100 text-sm leading-none"
                        />
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
