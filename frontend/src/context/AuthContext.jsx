import { useState } from "react";
import { AuthContext } from "./auth-context";

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

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
