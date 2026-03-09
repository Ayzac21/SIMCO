import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { API_BASE_URL } from "../../api/config";
import { useContext } from "react";
import { AuthContext } from "../../context/auth-context";

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

                // Fallback por datos legacy (URE/usuario)
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
            <div className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-principal mb-6">
                    Iniciar sesión
                </h2>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-left text-gray-700 mb-2 font-medium">
                            Usuario / Código
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: jefe.compras"
                            value={user_name}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-principal"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-left text-gray-700 mb-2 font-medium">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-principal"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full text-white py-2 rounded-lg font-semibold transition ${
                            loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-secundario hover:bg-red-700"
                        }`}
                    >
                        {loading ? "Ingresando..." : "Ingresar"}
                    </button>
                </form>

                {mensaje && (
                    <div className="mt-4 text-center bg-red-50 p-3 rounded border border-red-100">
                        <p className="font-medium text-red-600">{mensaje}</p>
                        <p className="text-[11px] text-red-500 mt-1">
                            Si el problema persiste, solicita asignación de perfil o URE válida.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
