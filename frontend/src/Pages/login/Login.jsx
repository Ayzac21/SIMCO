import { Link, useNavigate } from "react-router-dom";
import React, { useState } from "react";

export default function Login() {
    const [user_name, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMensaje("");

        try {
            const response = await fetch("http://localhost:4000/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_name, password }),
            });

            const data = await response.json();

            if (data.ok) {
                // --- DEBUG: MIRA ESTO EN LA CONSOLA (F12) ---
                console.log("Usuario logueado:", data.user);
                console.log("URE recibida:", data.user.ure);

                localStorage.setItem("usuario", JSON.stringify(data.user));
                localStorage.setItem("users_id", data.user.id);
                
                // Normalizamos la URE para evitar errores de mayúsculas/espacios
                const rawUre = data.user.ure || "";
                const ureLimpia = rawUre.toString().toUpperCase().trim();
                const userName = (data.user.user_name || "").toLowerCase();

                // 1. VALIDACIÓN COMPRAS (por rol o por URE/usuario)
                if (String(data.user?.role || "").startsWith("compras_")) {
                    console.log("Redirigiendo a Compras por rol...");
                    navigate("/compras/dashboard");
                    return;
                }
                if (ureLimpia === "COMPRAS" || userName === "jefe.compras" || userName === "compras") {
                    console.log("Redirigiendo a Compras...");
                    navigate("/compras/dashboard");
                    return;
                }

                // 2. VALIDACIÓN ACADÉMICA (Contar puntos)
                // Si la URE no tiene puntos (ej: "0"), split devolverá 1 elemento
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
                    // Si cae aquí es porque no cumplió ninguna condición anterior
                    console.log("No se reconoció perfil, enviando a default.");
                    navigate("/dashboard");
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
                    <p className="mt-4 text-center font-medium text-red-600 bg-red-50 p-2 rounded">{mensaje}</p>
                )}
            </div>
        </div>
    );
}
