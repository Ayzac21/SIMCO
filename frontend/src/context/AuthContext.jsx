import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(
        JSON.parse(localStorage.getItem("usuario")) || null
    );

    const login = (data) => {
        setUsuario(data);
        localStorage.setItem("usuario", JSON.stringify(data));
    };

    const logout = () => {
        setUsuario(null);
        localStorage.removeItem("usuario");
    };

    return (
        <AuthContext.Provider value={{ usuario, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// 👇 ESTE ES EL QUE TE FALTA
export const useAuth = () => {
    return useContext(AuthContext);
};
