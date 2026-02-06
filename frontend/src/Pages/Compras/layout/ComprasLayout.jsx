import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingCart, Archive, LayoutGrid, Users } from "lucide-react";

export default function ComprasLayout() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const navigate = useNavigate();

    // --- Usuario ---
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;

    const userName = user ? (user.name || user.user_name || "Compras") : "Compras";
    const userInitial = (userName?.[0] || "C").toUpperCase();

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
        "/compras/historial": {
            title: "Historial de Órdenes",
            subtitle: "Consulta de compras finalizadas",
        },
        "/compras/empleados": {
            title: "Personal de Compras",
            subtitle: "Gestión de usuarios del departamento",
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

    // --- Cerrar sidebar al cambiar de ruta (mejor UX móvil) ---
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

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
            <div className="p-6 flex items-center justify-center gap-2 border-b border-white/20">
            <ShoppingCart size={24} />
            <span className="text-xl font-bold">Compras</span>
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

                <NavLink to="/compras/empleados" className={linkClass}>
                    <Users size={20} />
                    Personal
                </NavLink>
            </nav>

            <div className="p-4 border-t border-white/20">
                <button
                    onClick={handleLogout}
                    className="w-full bg-red-800 py-2 rounded-lg font-semibold hover:bg-red-700 transition shadow-lg"
                >
                    Cerrar sesión
                </button>
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
                    <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-gray-800">Hola, {userName}</p>
                    <p className="text-xs text-gray-500 uppercase">
                        {user?.ure || "Departamento de Compras"}
                    </p>
                    </div>

                    <div className="h-10 w-10 rounded-full bg-secundario text-white flex items-center justify-center font-bold shadow-md text-lg border border-gray-100">
                    {userInitial}
                    </div>
                </div>
            </header>

            {/* Outlet */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 bg-gray-100">
                <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                    <Outlet />
                </div>
            </div>
        </main>
        </div>
    );
}
