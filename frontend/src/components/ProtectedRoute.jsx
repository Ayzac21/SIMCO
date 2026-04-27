import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/auth-context";

const isTokenExpired = (token) => {
    try {
        const parts = String(token || "").split(".");
        if (parts.length < 2) return true;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const payloadJson = atob(padded);
        const payload = JSON.parse(payloadJson);
        const exp = Number(payload?.exp || 0);
        if (!exp) return false;
        return Math.floor(Date.now() / 1000) >= exp;
    } catch {
        return true;
    }
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
    const { user } = useContext(AuthContext);

    const token = localStorage.getItem("token");
    if (!user || !token || isTokenExpired(token)) {
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        localStorage.removeItem("users_id");
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(String(user.role || ""))) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
