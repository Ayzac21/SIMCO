import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Archive, LayoutGrid, Users, Truck, Ruler, Eye } from "lucide-react";
import { canManageUnits } from "../unidades/unitsAccess";
import NotificationBell from "../../../components/NotificationBell";
import escudoCualtos from "../../../assets/escudo-cualtos-02_0_1.png";
import UserMenu from "../../../components/UserMenu";
import { getUserUnitLabel } from "../../../utils/unitDisplay";

export default function ComprasLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const navigate = useNavigate();

    // --- Usuario ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role || "";
    const isAdmin = role === "compras_admin";
    const canAccessUnits = canManageUnits(user);

    const userName = user ? (user.name || user.user_name || "Compras") : "Compras";
    const userInitial = (userName?.[0] || "C").toUpperCase();
    const userUnitLabel = getUserUnitLabel(user, "Departamento de Compras");

    // --- Headers por ruta ---
    const headers = useMemo(
        () => ({
        "/compras": {
            title: "Panel de Compras",
            subtitle: "Gestión de adquisiciones",
        },
        "/compras/dashboard": {
            title: "Requisiciones por Cotizar",
            subtitle: "Solicitudes autorizadas pendientes de precio",
        },
        "/compras/preparacion": {
            title: "Vista de Preparación",
            subtitle: "Borradores en creación para anticipar carga de trabajo",
        },
        "/compras/historial": {
            title: "Historial de Órdenes",
            subtitle: "Consulta de compras finalizadas",
        },
        "/compras/empleados": {
            title: "Personal de Compras",
            subtitle: "Gestión de usuarios del departamento",
        },
        "/compras/proveedores": {
            title: "Proveedores",
            subtitle: "Registro y administración de proveedores",
        },
        "/compras/unidades": {
            title: "Unidades de Medida",
            subtitle: "Catálogo de unidades para requisiciones",
        },
        "/compras/orden": {
            title: "Proceso de Compra",
            subtitle: "Selección del solicitante y preparación de la orden",
        },
        "/compras/revision": {
            title: "Revisión Interna",
            subtitle: "Selección final de proveedores por Compras Admin",
        },
        }),
        []
    );

    const headerInfo = useMemo(() => {
        // match exacto
        if (headers[pathname]) return headers[pathname];

        // match por prefijo (por si tienes /compras/cotizacion/:id)
        const match = Object.keys(headers)
        .filter((p) => p !== "/compras")
        .find((p) => pathname.startsWith(p));

        return headers[match] || headers["/compras/dashboard"] || { title: "Panel Compras", subtitle: "Sistema SIMCO" };
    }, [headers, pathname]);

    const isWideContentRoute = pathname.startsWith("/compras/cotizar/");
    const contentMaxWidthClass = isWideContentRoute ? "max-w-[2000px]" : "max-w-7xl";

    // --- Cerrar sidebar al cambiar de ruta (mejor UX móvil) ---
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isAdmin && pathname.startsWith("/compras/empleados")) {
            navigate("/compras/dashboard");
        }
    }, [isAdmin, pathname, navigate]);

    useEffect(() => {
        if (!isAdmin && pathname.startsWith("/compras/preparacion")) {
            navigate("/compras/dashboard");
        }
    }, [isAdmin, pathname, navigate]);

    useEffect(() => {
        if (!canAccessUnits && pathname.startsWith("/compras/unidades")) {
            navigate("/compras/dashboard");
        }
    }, [canAccessUnits, pathname, navigate]);

    // --- Bloquear scroll del body cuando el menú está abierto ---
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
        document.body.style.overflow = prev;
        };
    }, [open]);

    const linkClass = ({ isActive }) =>
        `flex items-center gap-2 py-2 px-4 rounded transition
        ${isActive ? "bg-white text-secundario font-semibold shadow-sm" : "hover:bg-white/20"}`;

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-gray-100">
        {/* Overlay móvil */}
        {open && (
            <div
            className="md:hidden fixed inset-0 z-30 bg-black/30"
            onClick={() => setOpen(false)}
            />
        )}

        {/* ================= SIDEBAR ================= */}
        <aside
            className={`
            bg-secundario text-white w-64 flex flex-col
            fixed md:static inset-y-0 left-0 z-40
            transform transition-transform duration-300
            ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            `}
            role="navigation"
            aria-label="Menú de Compras"
        >
            <div className="p-4 border-b border-white/20">
                <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 aspect-square shrink-0 rounded-full bg-white text-secundario font-bold flex items-center justify-center">
                            {userInitial}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{userName}</p>
                            <p className="text-[11px] text-white/80 uppercase truncate">{userUnitLabel}</p>
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <NavLink to="/compras/dashboard" className={linkClass}>
                    <LayoutGrid size={20} />
                    Por Cotizar
                </NavLink>

                <NavLink to="/compras/historial" className={linkClass}>
                    <Archive size={20} />
                    Historial OC
                </NavLink>

                {isAdmin && (
                    <NavLink to="/compras/preparacion" className={linkClass}>
                        <Eye size={20} />
                        Preparación
                    </NavLink>
                )}

                {isAdmin && (
                    <NavLink to="/compras/empleados" className={linkClass}>
                        <Users size={20} />
                        Personal
                    </NavLink>
                )}

                <NavLink to="/compras/proveedores" className={linkClass}>
                    <Truck size={20} />
                    Proveedores
                </NavLink>

                {canAccessUnits && (
                    <NavLink to="/compras/unidades" className={linkClass}>
                        <Ruler size={20} />
                        Unidades
                    </NavLink>
                )}
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
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
        >
            {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* ================= CONTENIDO PRINCIPAL ================= */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 py-4 md:py-5 px-4 md:px-10 shadow-sm flex justify-between items-center sticky top-0 z-20">
                {/* Izquierda */}
                <div className="pl-12 md:pl-0">
                    <h1 className="text-lg md:text-2xl font-bold text-gray-800 leading-tight">
                    {headerInfo.title}
                    </h1>
                    <p className="text-[11px] md:text-sm text-gray-500">
                    {headerInfo.subtitle}
                    </p>
                </div>

                {/* Derecha */}
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-gray-800">Bienvenido, {userName}</p>
                    <p className="text-xs text-gray-500 uppercase">
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

            {/* Outlet */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 bg-gray-100">
                <div className={`${contentMaxWidthClass} mx-auto animate-in fade-in duration-500`}>
                    <Outlet />
                </div>
            </div>
        </main>
        </div>
    );
}
