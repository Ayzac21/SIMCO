// server.js
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import requisicionRoutes from "./routes/requisiciones.js";
import categoriesRoutes from "./routes/categories.js";
import unitsRoutes from "./routes/units.js";
import coordinadorRoutes from "./routes/coordinador.js";
import secretariaRoutes from "./routes/secretaria.js";
import comprasRoutes from "./routes/compras.js";
import asistenteRoutes from "./routes/asistente.js";

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

// Catálogos (IMPORTANTE: antes de requisiciones)
app.use("/api/categories", categoriesRoutes);
app.use("/api/units", unitsRoutes);

// Requisiciones (IMPORTANTE: con prefijo)
app.use("/api/requisiciones", requisicionRoutes);

// Resto (se queda igual)
app.use("/api", coordinadorRoutes);
app.use("/api", secretariaRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/asistente", asistenteRoutes);

app.listen(4000, () => {
  console.log("Servidor listo en http://localhost:4000");
});
