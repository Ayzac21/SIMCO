// import React from 'react';
import { Link } from "react-router-dom";
import { GraduationCap, LogIn } from "lucide-react";

export default function Navbar() {
    return (
        // Quitamos px-8 fijo y usamos un container centrado para mejor alineación
        <nav className="w-full bg-principal text-white shadow-lg sticky top-0 z-50">
            <div className="container mx-auto px-6 py-3 flex justify-between items-center">
                
                {/* LOGO DE LA MARCA */}
                <Link to="/" className="flex items-center gap-3 group">
                    {/* Caja del icono con fondo transparente sutil */}
                    <div className="bg-white/10 p-2.5 rounded-lg border border-white/10 group-hover:bg-white/20 transition-all duration-300">
                        <GraduationCap size={26} className="text-white" />
                    </div>
                    
                    {/* Texto con jerarquía */}
                    <div className="flex flex-col">
                        <h1 className="font-bold text-xl tracking-tight leading-none">SIMIC</h1>
                        <p className="text-[10px] text-white/80 uppercase font-medium tracking-wider mt-0.5">
                            Sistema Institucional
                        </p>
                    </div>
                </Link>

                {/* BOTÓN DE ACCIÓN */}
                <Link to="/login">
                    <button className="flex items-center gap-2 bg-white text-principal font-bold px-5 py-2 rounded-lg hover:bg-gray-50 transition-all shadow-sm transform hover:-translate-y-0.5 active:translate-y-0">
                        <span>Ingresar</span>
                        <LogIn size={18} />
                    </button>
                </Link>
            </div>
        </nav>
    );
}