import { Link } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, FileCheck, ShieldCheck, ArrowRight } from "lucide-react";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 relative overflow-hidden font-sans">
            {/* --- FONDO DECORATIVO (Blobs estáticos) --- */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] rounded-full bg-red-100 opacity-50 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] rounded-full bg-gray-200 opacity-60 blur-3xl pointer-events-none"></div>

            <main className="flex-grow container mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between relative z-10">
                
                {/* === COLUMNA IZQUIERDA: TEXTO === */}
                <div className="md:w-1/2 space-y-8 text-center md:text-left animate-in slide-in-from-left duration-700">
                    
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-principal text-xs font-bold uppercase tracking-wider mb-2">
                        <ShieldCheck size={14} />
                        Plataforma Institucional
                    </div>

                    <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
                        Gestión inteligente para <span className="text-principal">Compras</span> y <span className="text-secundario">Presupuesto</span>
                    </h1>

                    <p className="text-lg text-gray-600 md:max-w-lg leading-relaxed">
                        Bienvenido a <strong>SIMIC</strong>. Centraliza requisiciones, valida presupuestos y gestiona órdenes de compra en un solo flujo de trabajo eficiente y transparente.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            to="/login"
                            className="group flex items-center justify-center gap-2 bg-secundario text-white font-semibold py-3.5 px-8 rounded-xl hover:bg-red-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                        >
                            Acceder al Sistema
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                        </Link>
                    </div>
                </div>

                {/* === COLUMNA DERECHA: VISUAL (Mockup Fijo) === */}
                <div className="md:w-1/2 mt-16 md:mt-0 relative flex justify-center animate-in slide-in-from-right duration-700 delay-150">
                    
                    {/* Elemento decorativo detrás */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-secundario/10 to-principal/5 rounded-full filter blur-2xl transform scale-90"></div>

                    {/* Tarjeta Principal (Dashboard Falso) - SIN MOVIMIENTO */}
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 max-w-sm w-full z-20">
                        {/* Header Falso */}
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-principal">
                                <LayoutDashboard size={20} />
                            </div>
                            <div>
                                <div className="h-2 w-24 bg-gray-200 rounded mb-1"></div>
                                <div className="h-2 w-16 bg-gray-100 rounded"></div>
                            </div>
                        </div>
                        {/* Gráficas Falsas */}
                        <div className="flex items-end gap-2 h-32 mb-6 px-2">
                            <div className="w-1/4 bg-red-100 h-[40%] rounded-t-md"></div>
                            <div className="w-1/4 bg-red-200 h-[60%] rounded-t-md"></div>
                            <div className="w-1/4 bg-principal h-[80%] rounded-t-md shadow-md"></div>
                            <div className="w-1/4 bg-secundario h-[50%] rounded-t-md"></div>
                        </div>
                        {/* Lista Falsa */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                                <div className="h-8 w-8 rounded bg-white border border-gray-200 flex items-center justify-center text-green-600"><FileCheck size={16}/></div>
                                <div className="flex-1 h-2 bg-gray-300 rounded w-full"></div>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                                <div className="h-8 w-8 rounded bg-white border border-gray-200 flex items-center justify-center text-blue-600"><ShoppingCart size={16}/></div>
                                <div className="flex-1 h-2 bg-gray-300 rounded w-3/4"></div>
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta Secundaria (Decorativa) - SIN MOVIMIENTO */}
                    <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-gray-100 z-30">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-full text-green-700">
                                <FileCheck size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Estado</p>
                                <p className="text-sm font-bold text-gray-800">Autorizado</p>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}