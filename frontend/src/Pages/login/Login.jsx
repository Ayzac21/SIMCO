import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { API_BASE_URL } from "../../api/config";
import { useContext } from "react";
import { AuthContext } from "../../context/auth-context";
import { LockKeyhole, UserRound, AlertCircle, ArrowLeft } from "lucide-react";
import escudoCualtos from "../../assets/escudo-cualtos-02_0_1.png";
import Navbar from "../../components/Navbar";

export default function Login() {
    const [user_name, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMensaje("");

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_name, password }),
            });

            const data = await response.json();

            if (data.ok) {
                localStorage.setItem("usuario", JSON.stringify(data.user));
                if (data.token) {
                    localStorage.setItem("token", data.token);
                }
                localStorage.setItem("users_id", data.user.id);
                login(data.user);

                const rawUre = data.user.ure || "";
                const ureLimpia = rawUre.toString().toUpperCase().trim();
                const userName = (data.user.user_name || "").toLowerCase();
                const role = String(data.user?.role || "");

                if (role.startsWith("compras_")) {
                    navigate("/compras/dashboard");
                    return;
                }

                if (role === "secretaria") {
                    navigate("/secretaria/dashboard");
                    return;
                }

                if (role === "coordinador") {
                    navigate("/coordinador/dashboard");
                    return;
                }

                if (role === "head_office") {
                    navigate("/unidad/dashboard");
                    return;
                }

                if (ureLimpia === "COMPRAS" || userName === "jefe.compras" || userName === "compras") {
                    navigate("/compras/dashboard");
                    return;
                }

                const niveles = rawUre.includes('.') ? rawUre.split('.').length : 0;

                if (niveles === 3) {
                    navigate("/secretaria/dashboard");
                }
                else if (niveles === 4) {
                    navigate("/coordinador/dashboard");
                }
                else if (niveles >= 5) {
                    navigate("/unidad/dashboard");
                }
                else {
                    setMensaje("Perfil no reconocido. Contacta al administrador.");
                    navigate("/login");
                }

            } else {
                setMensaje("Credenciales inválidas");
            }
        } catch (error) {
            console.error(error);
            setMensaje("Error en el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 relative overflow-hidden">
            <Navbar actionButton={{ to: "/", label: "Volver", mobileLabel: "Volver", icon: ArrowLeft }} />
            <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-red-100/75 to-transparent pointer-events-none"></div>

            <div className="relative z-10 min-h-[calc(100vh-76px)] lg:h-[calc(100vh-76px)] w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-6 flex items-center justify-center">
                <section className="w-full max-w-5xl rounded-3xl border border-white/20 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.12)] overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12">
                        <aside className="relative lg:col-span-5 bg-principal border-b lg:border-b-0 lg:border-r border-white/15 p-6 sm:p-8 lg:p-9 overflow-hidden">
                            <div className="absolute -top-20 -left-14 h-56 w-56 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
                            <div className="absolute -top-3 -left-4 h-36 w-36 rounded-full bg-white/20 blur-2xl pointer-events-none"></div>
                            <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                            <div className="relative z-10 h-full flex items-center">
                                <div className="w-full max-w-sm mx-auto">
                                    <p className="text-xl sm:text-2xl font-extrabold text-white leading-none tracking-tight">CUAltos</p>
                                    <p className="mt-2 text-xs sm:text-sm uppercase tracking-[0.12em] text-white/80 font-medium">
                                        Sistema Institucional de Compras
                                    </p>

                                    <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-3.5">
                                        <p className="text-xs font-semibold text-white uppercase tracking-wide">Aviso</p>
                                        <p className="text-xs sm:text-sm text-white/85 mt-1">
                                            El acceso es institucional y exclusivo para personal autorizado.
                                        </p>
                                    </div>

                                    <div className="mt-6 sm:mt-8 flex justify-center">
                                        <img
                                            src={escudoCualtos}
                                            alt="Escudo oficial CUAltos"
                                            className="h-16 sm:h-20 w-auto object-contain translate-y-1 sm:translate-y-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <main className="lg:col-span-7 p-6 sm:p-8 lg:p-10 bg-white">
                            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                Iniciar sesión
                            </h3>
                            <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                                Ingresa con tus credenciales institucionales.
                            </p>

                            <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                                <div>
                                    <label className="block text-left text-gray-700 mb-2 font-medium">
                                        Usuario / Código
                                    </label>
                                    <div className="relative">
                                        <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Ej: jefe.compras"
                                            value={user_name}
                                            onChange={(e) => setUserName(e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-principal/30 focus:border-principal"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-left text-gray-700 mb-2 font-medium">
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="password"
                                            placeholder="********"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-principal/30 focus:border-principal"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full text-white py-2.5 sm:py-3 rounded-xl font-semibold transition ${
                                        loading
                                            ? "bg-slate-400 cursor-not-allowed"
                                            : "bg-secundario hover:bg-red-700"
                                    }`}
                                >
                                    {loading ? "Ingresando..." : "Ingresar"}
                                </button>
                            </form>

                            {mensaje && (
                                <div className="mt-5 text-left bg-red-50 p-3.5 rounded-xl border border-red-100">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-medium text-red-700">{mensaje}</p>
                                            <p className="text-xs text-red-600 mt-1">
                                                Si el problema persiste, solicita asignación de perfil o URE válida.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </main>
                    </div>
                </section>
            </div>
        </div>
    );
}
