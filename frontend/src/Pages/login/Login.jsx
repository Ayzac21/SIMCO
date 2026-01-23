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
                // Guardar datos de sesión
                localStorage.setItem("usuario", JSON.stringify(data.user));
                localStorage.setItem("users_id", data.user.id);
                
                // --- LÓGICA AUTOMÁTICA POR NIVELES ---
                const ure = data.user.ure || ""; 
                const niveles = ure.split('.').length; // Cuenta cuántos segmentos tiene (Ej: 3.1.2 = 3)

                // 1. Secretario (Ej: 3.1.2 o 3.1.1) -> Tiene 3 niveles
                if (niveles === 3) {
                    navigate("/secretaria/dashboard");
                } 
                // 2. Coordinador (Ej: 3.1.2.7) -> Tiene 4 niveles
                else if (niveles === 4) {
                    navigate("/coordinador/dashboard");
                } 
                // 3. Unidades / Asistentes (Ej: 3.1.2.7.2) -> Tiene 5 niveles o más
                else if (niveles >= 5) {
                    navigate("/unidad/dashboard");
                } 
                // Fallback por seguridad
                else {
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
                        <label className="block text-left text-gray-700 mb-2">
                            Código de empleado
                        </label>
                        <input
                            type="text"
                            placeholder="Ejemplo: 123456"
                            value={user_name}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-principal"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-left text-gray-700 mb-2">
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
                    <p className="mt-4 text-center font-medium text-gray-700">{mensaje}</p>
                )}

                <p className="text-center text-gray-600 mt-6 text-sm">
                    ¿No tienes cuenta?{" "}
                    <Link to="/" className="text-principal font-semibold hover:underline">
                        Regresar al inicio
                    </Link>
                </p>
            </div>
        </div>
    );
}