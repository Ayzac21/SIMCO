import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/auth-context";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
    const { user } = useContext(AuthContext);

    const token = localStorage.getItem("token");
    if (!user || !token) return <Navigate to="/login" replace />;

    if (allowedRoles.length > 0 && !allowedRoles.includes(String(user.role || ""))) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
