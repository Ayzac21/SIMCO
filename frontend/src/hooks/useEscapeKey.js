import { useEffect } from "react";

export default function useEscapeKey(active, onEscape, disabled = false) {
  useEffect(() => {
    if (!active || disabled || typeof onEscape !== "function") return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onEscape, disabled]);
}
