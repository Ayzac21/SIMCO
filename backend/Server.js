// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import requisicionRoutes from "./routes/requisiciones.js";
import categoriesRoutes from "./routes/categories.js";
import unitsRoutes from "./routes/units.js";
import coordinadorRoutes from "./routes/coordinador.js";
import secretariaRoutes from "./routes/secretaria.js";
import comprasRoutes from "./routes/compras.js";
import asistenteRoutes from "./routes/asistente.js";
import catalogsRoutes from "./routes/catalogs.js";
import usersRoutes from "./routes/users.js";
import notificationsRoutes from "./routes/notifications.js";
import timelineRoutes from "./routes/timeline.js";
import { authenticateJWT } from "./middleware/auth.js";
import { cleanupOrphanRequisitionUploads } from "./services/uploadsCleanup.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET en variables de entorno. El servidor no puede iniciar.");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "API del sistema SIMCO corriendo correctamente",
    status: "OK",
  });
});

// Auth (se queda igual)
app.use("/api", authRoutes);

// Middleware de auth para el resto de rutas
app.use("/api", authenticateJWT);

// Catálogos (IMPORTANTE: antes de requisiciones)
app.use("/api/categories", categoriesRoutes);
app.use("/api/units", unitsRoutes);
app.use("/api/catalogs", catalogsRoutes);

// Requisiciones (IMPORTANTE: con prefijo)
app.use("/api/requisiciones", requisicionRoutes);

// Resto (se queda igual)
app.use("/api", coordinadorRoutes);
app.use("/api", secretariaRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/asistente", asistenteRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api", timelineRoutes);

const cleanupEnabled = String(process.env.CLEANUP_UPLOADS_ENABLED || "true").toLowerCase() === "true";
const cleanupIntervalMinutes = Number(process.env.CLEANUP_UPLOADS_INTERVAL_MINUTES || 180);
const cleanupGraceMinutes = Number(process.env.CLEANUP_UPLOADS_GRACE_MINUTES || 120);
const cleanupMaxDelete = Number(process.env.CLEANUP_UPLOADS_MAX_DELETE || 200);

if (cleanupEnabled) {
  let cleanupRunning = false;
  const runCleanup = async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      await cleanupOrphanRequisitionUploads({
        dryRun: false,
        graceMinutes: cleanupGraceMinutes,
        maxDelete: cleanupMaxDelete,
        logger: console,
      });
    } catch (error) {
      console.error("[cleanup] error ejecutando job programado:", error);
    } finally {
      cleanupRunning = false;
    }
  };

  setTimeout(runCleanup, 30 * 1000);
  setInterval(runCleanup, Math.max(15, cleanupIntervalMinutes) * 60 * 1000);
}

app.listen(4000, () => {
  console.log("Servidor listo en http://localhost:4000");
});
