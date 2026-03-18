import jwt from "jsonwebtoken";

const getJwtSecret = () => process.env.JWT_SECRET;

export const authenticateJWT = (req, res, next) => {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({ message: "Configuración inválida del servidor" });
  }
  const auth = String(req.header("authorization") || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "No autorizado" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
};

export const requireRoles = (...roles) => {
  return (req, res, next) => {
    const role = req.user?.role || "";
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    return next();
  };
};
