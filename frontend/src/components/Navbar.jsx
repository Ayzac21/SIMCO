import '../index.css'
import { Link } from "react-router-dom";


export default function Navbar() {
    return (
        <nav className="w-full bg-principal text-white px-8 py-4 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
                <div className="bg-white rounded-full p-2">
                    <span className="text-primary font-bold text-xl">🎓</span>
                </div>
                <h1 className="font-semibold text-lg">Sistema SIMIC</h1>
            </div>

            <Link
                to="/login"
            >
                <button className="bg-white text-principal font-bold px-4 py-2 rounded-md hover:bg-gray-200 transition">
                    Iniciar sesión
                </button>
            </Link>
            
        </nav>
    );
}
