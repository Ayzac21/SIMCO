import { Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Login from "./Pages/login/Login";
import Dashboard from "./Pages/dashboard/Dashboard";

// --- URE (Solicitante) ---
import UreLayout from "./Pages/Asistente/layout/UreLayout";
import RequisicionesUre from "./Pages/Asistente/RequisicionesUre";
import UreDashboard from "./Pages/Asistente/UreDashboar"; 
import ListaRequisiciones from "./Pages/Asistente/ListaRequisiciones";
import EditarRequisicion from "./Pages/Asistente/EditarRequisicion";

// --- COORDINADOR ---
import CoorDasboard from "./Pages/coordinador/dasboard/CoorDasboard";
import CoordinadorLayout from "./Pages/coordinador/layout/CoordinadorLayout";
import Recibidas from "./Pages/coordinador/requisiciones/Recibidas";

// --- SECRETARÍA (NUEVO) ---
import SecretariaLayout from "./Pages/Secretaria/layout/SecretariaLayout";
import SecDashboard from "./Pages/Secretaria/dashboard/SecDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    
      {/* Rutas de Unidad */}
      <Route path="/unidad" element={<UreLayout />}>
        <Route path="dashboard" element={<UreDashboard />} />
        <Route path="mi-requisiciones" element={<ListaRequisiciones />} /> 
        <Route path="requisiciones/nueva" element={<RequisicionesUre />} /> 
        <Route path="requisiciones/editar/:id" element={<EditarRequisicion />} />
      </Route>

      {/* Rutas de Coordinador */}
      <Route path="/coordinador" element={<CoordinadorLayout />}>
        <Route path="dashboard" element={<CoorDasboard />} />
        <Route path="requisiciones" element={<Recibidas />} />
      </Route>

      {/* Rutas de Secretaría (NUEVO BLOQUE) */}
      <Route path="/secretaria" element={<SecretariaLayout />}>
        <Route path="dashboard" element={<SecDashboard />} />
        {/* Aquí podrás agregar más rutas como "historial" o "reportes" después */}
      </Route>

    </Routes>
  );
}