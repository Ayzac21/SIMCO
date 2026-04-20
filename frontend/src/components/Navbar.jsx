// import React from 'react';
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import escudoCualtos from "../assets/escudo-cualtos-02_0_1.png";

export default function Navbar({ showLoginButton = true, actionButton = null }) {
    const defaultButton = showLoginButton
        ? { to: "/login", label: "Ingresar", mobileLabel: "Entrar", icon: LogIn }
        : null;

    const activeButton = actionButton || defaultButton;
    const ButtonIcon = activeButton?.icon || LogIn;

    return (
        <nav className="w-full bg-principal text-white shadow-md sticky top-0 z-50 border-b border-white/15">
            <div className="w-full px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
                
                {/* LOGO DE LA MARCA */}
                <Link to="/" className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <div className="shrink-0 bg-white/10 px-2 sm:px-2.5 py-1.5 rounded-lg border border-white/10">
                        <img
                            src={escudoCualtos}
                            alt="Escudo oficial CUAltos"
                            className="h-11 sm:h-14 md:h-[3.9rem] w-auto object-contain drop-shadow-sm"
                        />
                    </div>
                    
                    {/* Texto con jerarquía */}
                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-lg sm:text-xl md:text-2xl tracking-tight leading-none">
                            SIMCO
                        </h1>
                        <p className="sm:hidden text-[10px] text-white/85 uppercase font-semibold tracking-wide mt-0.5 truncate">
                            CUAltos
                        </p>
                        <p className="hidden sm:block text-[10px] md:text-[11px] text-white/85 uppercase font-semibold tracking-wide mt-0.5">
                            CUAltos · Sistema Institucional de Compras
                        </p>
                    </div>
                </Link>

                {/* BOTÓN DE ACCIÓN */}
                {activeButton && (
                    <Link to={activeButton.to} className="group shrink-0">
                        <button className="inline-flex items-center gap-2 bg-white text-principal font-semibold text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/80 hover:bg-slate-50 transition-colors duration-200 whitespace-nowrap">
                            <span className="hidden sm:inline">{activeButton.label}</span>
                            <span className="sm:hidden">{activeButton.mobileLabel || activeButton.label}</span>
                            <span className="inline-flex items-center justify-center rounded-full bg-principal/10 p-1 text-principal group-hover:bg-principal/15 transition-colors">
                                <ButtonIcon size={16} />
                            </span>
                        </button>
                    </Link>
                )}
            </div>
        </nav>
    );
}
