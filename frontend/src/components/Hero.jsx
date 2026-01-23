import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex flex-col items-center justify-center flex-grow bg-white p-8">
                <div className="bg-fondo p-16 shadow-2xl w-full max-w-4xl text-center rounded-t-2xl">
                    <div className="flex justify-center mb-10">
                        <div className="text-7xl text-simic-primary">🎓</div>
                    </div>

                    <h2 className="text-4xl font-light text-secundario mb-3">
                        <span className="font-extrabold text-principal mr-1">SIMIC</span>
                        - Sistema de Monitoreo y Compras
                    </h2>

                    <p className="text-lg text-gray-600 mb-10">
                        Bienvenido a la Plataforma de gestión académica y administrativa
                    </p>

                    <Link
                        to="/login"
                        className="bg-secundario text-white font-semibold py-3 px-10 rounded-lg transition duration-300 hover:bg-red-700 shadow-md inline-block"
                    >
                        Empieza ahora
                    </Link>
                </div>

                <div className="bg-alerta h-16 w-full max-w-4xl rounded-b-2xl"></div>
            </div>
        </div>
    );
}
