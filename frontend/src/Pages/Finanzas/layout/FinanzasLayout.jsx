import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Archive, Banknote, LayoutDashboard, LayoutGrid, Menu, Settings, X } from "lucide-react";
import NotificationBell from "../../../components/NotificationBell";
import UserMenu from "../../../components/UserMenu";
import escudoCualtos from "../../../assets/escudo-cualtos-02_0_1.png";

export default function FinanzasLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const userStr = localStorage.getItem("usuario");
  const user = userStr ? JSON.parse(userStr) : null;
  const userName = user ? user.name || user.user_name || "Finanzas" : "Finanzas";
  const userInitial = (userName?.[0] || "F").toUpperCase();
  const userUnitLabel = user?.ure_name || user?.ure || "Coordinación de Finanzas";

  const headerInfo = useMemo(() => {
    if (pathname.startsWith("/finanzas/dashboard")) {
      return {
        title: "Dashboard de Finanzas",
        subtitle: "Pendientes, montos y actividad presupuestal",
      };
    }
    if (pathname.startsWith("/finanzas/requisiciones/")) {
      return {
        title: "Detalle presupuestal",
        subtitle: "Información de compra y captura financiera",
      };
    }
    if (pathname.startsWith("/finanzas/historial")) {
      return {
        title: "Historial de Finanzas",
        subtitle: "Requisiciones revisadas por presupuesto",
      };
    }
    if (pathname.startsWith("/finanzas/catalogos")) {
      return {
        title: "Catálogos financieros",
        subtitle: "Proyectos, fondos y programas estratégicos",
      };
    }
    return {
      title: "Revisión presupuestal",
      subtitle: "Requisiciones enviadas por Compras para proyecto, fondo y programa",
    };
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 rounded px-4 py-2 transition ${
      isActive ? "bg-white text-secundario font-semibold shadow-sm" : "text-white hover:bg-white/20"
    }`;

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100">
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[15rem] transform flex-col bg-secundario text-white transition-transform duration-300 md:static md:translate-x-0 xl:w-64 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Menú de Finanzas"
      >
        <div className="border-b border-white/20 p-4">
          <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-bold text-secundario">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="truncate text-[11px] uppercase text-white/80">{userUnitLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <NavLink to="/finanzas/dashboard" className={linkClass}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/finanzas/recibidas" className={linkClass}>
            <LayoutGrid size={20} />
            Recibidas
          </NavLink>
          <NavLink to="/finanzas/historial" className={linkClass}>
            <Archive size={20} />
            Historial
          </NavLink>
          <NavLink to="/finanzas/catalogos" className={linkClass}>
            <Settings size={20} />
            Catálogos
          </NavLink>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-xs leading-relaxed text-white/80">
            <div className="mb-2 flex items-center gap-2 font-bold text-white">
              <Banknote size={16} />
              Flujo Finanzas
            </div>
            Valida presupuesto y captura proyecto, fondo y programa antes del cierre de compra.
          </div>
        </nav>

        <div className="relative overflow-hidden border-t border-white/20 p-2">
          <div className="pointer-events-none absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
          <img
            src={escudoCualtos}
            alt="Escudo institucional UDG CUAltos"
            className="relative z-10 block h-auto w-full object-contain"
          />
        </div>
      </aside>

      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-lg bg-secundario p-2 text-white shadow-md md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3.5 shadow-sm sm:px-6 sm:py-4 lg:px-8 lg:py-5 xl:px-10">
          <div className="pl-12 md:pl-0">
            <h1 className="text-lg font-bold leading-tight text-gray-800 sm:text-xl lg:text-2xl">
              {headerInfo.title}
            </h1>
            <p className="text-[11px] text-gray-500 sm:text-xs lg:text-sm">{headerInfo.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right md:block">
              <p className="text-sm font-bold text-gray-800">Bienvenido, {userName}</p>
              <p className="text-xs uppercase text-gray-500">{userUnitLabel}</p>
            </div>
            <UserMenu userName={userName} userInitial={userInitial} subtitle={userUnitLabel} onLogout={handleLogout} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-100 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 xl:px-10">
          <div className="mx-auto max-w-[1280px] animate-in fade-in duration-500">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
