import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut } from "lucide-react";
import { Toaster } from 'sonner';

export default function SecretariaLayout() {
    const navigate = useNavigate();
    
    // Recuperar usuario o poner default
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : { name: "Secretaría", user_name: "SEC" };
    const userName = user.name || user.user_name;
    const initial = userName.charAt(0).toUpperCase();

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <div className="flex h-screen w-full bg-[#F3F4F6] font-sans overflow-hidden">
            <Toaster position="top-right" richColors />

            {/* SIDEBAR - Color exacto del Coordinador */}
            <aside className="w-64 bg-[#8B1D35] text-white flex flex-col shadow-xl z-20">
                <div className="h-16 flex items-center px-6 font-bold text-xl tracking-wide border-b border-white/10">
                    Secretaría
                </div>

                <nav className="flex-1 py-6 px-3 space-y-2">
                    <NavLink 
                        to="/secretaria/dashboard" 
                        className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-white text-[#8B1D35] shadow-md font-bold" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                    >
                        <LayoutGrid size={20} />
                        Dashboard
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button 
                        onClick={handleLogout} 
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#701529] hover:bg-[#5a1020] rounded-lg text-sm font-bold transition-colors shadow-sm"
                    >
                        <LogOut size={18} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-8 shadow-sm z-10">
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">Panel Administrativo</h1>
                        <p className="text-xs text-gray-500">Gestión y validación de presupuesto</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-800 uppercase">{userName}</p>
                            <p className="text-[10px] text-gray-500">Secretaría</p>
                        </div>
                        <div className="h-9 w-9 rounded-full bg-[#8B1D35] text-white flex items-center justify-center font-bold text-sm shadow-sm border border-gray-100">
                            {initial}
                        </div>
                    </div>
                </header>

                {/* Área de trabajo */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}