// server.js
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import requisitionRoutes from "./routes/requisiciones.js";
import categoriesRoutes from "./routes/categories.js";
import unitsRoutes from "./routes/units.js";
import coordinadorRoutes from './routes/coordinador.js'
import secretariaRoutes from './routes/secretaria.js';


const app = express();

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.json({ 
        message: 'API del sistema SIMCO corriendo correctamente',
        status: 'OK'
    });
});

// Rutas API
app.use("/api", authRoutes);
app.use("/api", requisitionRoutes);
app.use("/api", categoriesRoutes);
app.use("/api", unitsRoutes);
app.use("/api", coordinadorRoutes);
app.use('/api', secretariaRoutes);




app.listen(4000, () => {
    console.log("Servidor listo en http://localhost:4000");
});