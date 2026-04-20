import React, { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

export default function UserMenu({
    userName,
    userInitial,
    subtitle,
    onLogout,
    avatarClassName = "h-10 w-10 aspect-square shrink-0 rounded-full bg-secundario text-white flex items-center justify-center font-bold shadow-md text-lg border border-gray-100 leading-none",
    menuAlignClassName = "right-0",
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const onDocClick = (e) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`${avatarClassName} cursor-pointer`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Abrir menú de usuario"
            >
                {userInitial}
            </button>

            {open && (
                <div
                    className={`absolute ${menuAlignClassName} mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden`}
                    role="menu"
                >
                    <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
                        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onLogout();
                        }}
                        className="w-full px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50 inline-flex items-center gap-2"
                        role="menuitem"
                    >
                        <LogOut size={16} />
                        Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
