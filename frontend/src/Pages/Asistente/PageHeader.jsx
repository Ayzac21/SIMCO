import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NotificationBell from "../../components/NotificationBell";
import UserMenu from "../../components/UserMenu";
import { getUserUnitLabel } from "../../utils/unitDisplay";

export default function PageHeader({ title, subtitle }) {
    const navigate = useNavigate();
    const location = useLocation();
    const userStr = localStorage.getItem("usuario");
    const user = userStr ? JSON.parse(userStr) : null;
    const userName = user ? (user.name || user.user_name || "Usuario") : "Usuario";
    const userInitial = (userName?.[0] || "U").toUpperCase();
    const userUnitLabel = getUserUnitLabel(user, "Unidad Responsable");

    const crumbs = location.pathname
        .split("/")
        .filter(Boolean)
        .slice(1);

    const handleLogout = () => {
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        localStorage.removeItem("users_id");
        window.location.href = "/";
    };

    return (
        <div className="sticky top-0 z-30 bg-white border-b backdrop-blur-sm">
            <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-3.5 sm:py-4 flex flex-col gap-1">

                {/* Breadcrumbs */}
                <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span
                        className="cursor-pointer hover:text-gray-600"
                        onClick={() => navigate("/unidad/dashboard")}
                    >
                        Inicio
                    </span>
                    {crumbs.map((c, i) => (
                        <span key={i}>/ {c.replace("-", " ")}</span>
                    ))}
                </div>

                {/* Header principal */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-xl sm:text-2xl text-gray-500 hover:text-gray-800 transition"
                        >
                            ←
                        </button>

                        <div>
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-xs lg:text-sm text-gray-500 mt-1">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-gray-800">Bienvenido, {userName}</p>
                            <p className="text-xs text-gray-500">{userUnitLabel}</p>
                        </div>
                        <UserMenu
                            userName={userName}
                            userInitial={userInitial}
                            subtitle={userUnitLabel}
                            onLogout={handleLogout}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
