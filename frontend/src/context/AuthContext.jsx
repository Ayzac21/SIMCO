import { useEffect, useState } from "react";
import { AuthContext } from "./auth-context";
import { API_BASE_URL } from "../api/config";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(
        JSON.parse(localStorage.getItem("usuario")) || null
    );

    const login = (data) => {
        setUser(data);
        localStorage.setItem("usuario", JSON.stringify(data));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
        localStorage.removeItem("users_id");
    };

    useEffect(() => {
        const hydrateUreName = async () => {
            if (!user?.ure || user?.ure_name) return;
            const token = localStorage.getItem("token");
            if (!token) return;

            const roleCandidates = ["head_office", "secretaria", "coordinador"];
            const normalize = (v) => String(v || "").trim().toUpperCase();
            const userUre = normalize(user.ure);
            if (!userUre) return;

            for (const role of roleCandidates) {
                try {
                    const res = await fetch(`${API_BASE_URL}/catalogs/ures?role=${role}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) continue;
                    const rows = await res.json().catch(() => []);
                    const found = Array.isArray(rows)
                        ? rows.find((r) => normalize(r?.ure) === userUre)
                        : null;
                    const name = String(found?.nombre_ure || "").trim();
                    if (!name) continue;

                    const nextUser = { ...user, ure_name: name };
                    setUser(nextUser);
                    localStorage.setItem("usuario", JSON.stringify(nextUser));
                    break;
                } catch {
                    // Continuar con el siguiente catálogo
                }
            }
        };

        hydrateUreName();
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
