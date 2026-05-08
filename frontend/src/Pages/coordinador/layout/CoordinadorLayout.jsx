import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X, LayoutGrid, FileText, PlusCircle } from "lucide-react";
import NotificationBell from "../../../components/NotificationBell";
import escudoCualtos from "../../../assets/escudo-cualtos-02_0_1.png";
import UserMenu from "../../../components/UserMenu";
import { getUserUnitLabel } from "../../../utils/unitDisplay";
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
    const userUnitLabel = getUserUnitLabel(user, "Coordinación");

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
    const headerInfo =
        headers[pathname] ||
        Object.entries(headers).find(([path]) => pathname.startsWith(path))?.[1] ||
    { title: "Panel Coordinador", subtitle: "Sistema SIMCO" };

    const handleLogout = () => {
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        localStorage.removeItem("users_id");
        window.location.href = "/";
    };

    const linkClass = ({ isActive }) =>
        `flex items-center gap-2 py-2 px-4 rounded transition ${
            isActive
                ? "bg-white text-secundario font-semibold shadow-sm"
                : "hover:bg-white/20"
        }`;

    
    return (
        <div className="flex h-screen w-full overflow-hidden bg-gray-100">

            {/* ================= SIDEBAR ================= */}
            <aside
                className={`
                    bg-secundario text-white w-[15rem] xl:w-64 flex flex-col
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
                                <p className="text-[11px] text-white/80 truncate">{userUnitLabel}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavLink
                        to="/coordinador/dashboard"
                        className={linkClass}
                    >
                        <LayoutGrid size={20} />
                        Dashboard
                    </NavLink>

                    {/* Ajusta 'to' según tu ruta real de recibidas */}
                    <NavLink
                        to="/coordinador/requisiciones"
                        end
                        className={linkClass}
                    >
                        <FileText size={20} />
                        Requisiciones
                    </NavLink>

                    <NavLink
                        to="/coordinador/requisiciones/nueva"
                        className={linkClass}
                    >
                        <PlusCircle size={20} />
                        Nueva requisición
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

                {/* --- NUEVO HEADER INTEGRADO --- */}
                <header className="bg-white border-b border-gray-200 py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 xl:px-10 shadow-sm flex justify-between items-center sticky top-0 z-30">
                    
                    {/* IZQUIERDA: TÍTULO Y SUBTÍTULO (Dinámicos) */}
                    <div className="ml-10 md:ml-0"> {/* Margin left para no tapar el botón hamburguesa en móvil */}
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                            {headerInfo.title}
                        </h1>
                        <p className="text-[11px] sm:text-xs lg:text-sm text-gray-500">
                            {headerInfo.subtitle}
                        </p>
                    </div>

                    {/* DERECHA: INFORMACIÓN DEL USUARIO */}
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-800">Bienvenido, {userName}</p>
                            <p className="text-xs text-gray-500">
                                {userUnitLabel}
                            </p>
                        </div>
                        
                        <UserMenu
                            userName={userName}
                            userInitial={userInitial}
                            subtitle={userUnitLabel}
                            onLogout={handleLogout}
                        />
                    </div>
                </header>

                {/* --- ÁREA DE CONTENIDO (OUTLET) --- */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 lg:py-6 bg-gray-100">
                    <div className="max-w-7xl mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </div>

            </main>
        </div>
    );
}
