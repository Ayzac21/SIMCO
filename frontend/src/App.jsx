import { Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Login from "./Pages/login/Login";

// --- URE (Solicitante) ---
import UreLayout from "./Pages/Asistente/layout/UreLayout";
import RequisicionesUre from "./Pages/Asistente/RequisicionesUre";
import UreDashboard from "./Pages/Asistente/UreDashboar";
import ListaRequisiciones from "./Pages/Asistente/ListaRequisiciones";
import EditarRequisicion from "./Pages/Asistente/EditarRequisicion";

// NUEVO (URE revisión)
import RequisicionesRevision from "./Pages/Asistente/RequisicionesRevision";
import RevisionCotizacion from "./Pages/Asistente/RevisionCotizacion";

// --- COORDINADOR ---
import CoorDasboard from "./Pages/coordinador/dasboard/CoorDasboard";
import CoordinadorLayout from "./Pages/coordinador/layout/CoordinadorLayout";
import Recibidas from "./Pages/coordinador/requisiciones/Recibidas";
import NuevaRequisicionCoor from "./Pages/coordinador/requisiciones/NuevaRequisicionCoor"; // ✅ NUEVO
import EditarRequisicionCoor from "./Pages/coordinador/requisiciones/EditarRequisicionCoor";

// --- SECRETARÍA ---
import SecretariaLayout from "./Pages/Secretaria/layout/SecretariaLayout";
import SecDashboard from "./Pages/Secretaria/dashboard/SecDashboard";
import SecRecibidas from "./Pages/Secretaria/SecRecibidas";

// --- Compras ---
import ComprasLayout from "./Pages/Compras/layout/ComprasLayout";
import ComprasDashboard from "./Pages/Compras/Dashboard/ComprasDashboard";
import GestionCotizacion from "./Pages/Compras/cotizaciones/GestionCotizacion";
import ComprasHistorial from "./Pages/Compras/historial/ComprasHistorial";
import ComprasPersonal from "./Pages/Compras/personal/ComprasPersonal";
import OrdenCompra from "./Pages/Compras/orden/OrdenCompra";
import ComprasProveedores from "./Pages/Compras/proveedores/ComprasProveedores";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Rutas de Unidad */}
      <Route path="/unidad" element={<UreLayout />}>
        <Route path="dashboard" element={<UreDashboard />} />
        <Route path="mi-requisiciones" element={<ListaRequisiciones />} />
        <Route path="requisiciones/nueva" element={<RequisicionesUre />} />
        <Route path="requisiciones/editar/:id" element={<EditarRequisicion />} />

        {/* ✅ RUTAS PARA REVISIÓN */}
        <Route path="revision" element={<RequisicionesRevision />} />
        <Route path="revision/:id" element={<RevisionCotizacion />} />
      </Route>

      {/* Rutas de Coordinador */}
      <Route path="/coordinador" element={<CoordinadorLayout />}>
        <Route path="dashboard" element={<CoorDasboard />} />
        <Route path="requisiciones" element={<Recibidas />} />
        <Route path="requisiciones/nueva" element={<NuevaRequisicionCoor />} /> {/* ✅ NUEVO */}
        <Route path="requisiciones/editar/:id" element={<EditarRequisicionCoor />} />
      </Route>

      {/* Rutas de Secretaría */}
      <Route path="/secretaria" element={<SecretariaLayout />}>
        <Route path="dashboard" element={<SecDashboard />} />
        <Route path="recibidas" element={<SecRecibidas />} />
      </Route>

      {/* RUTAS DE COMPRAS */}
      <Route path="/compras" element={<ComprasLayout />}>
        <Route path="dashboard" element={<ComprasDashboard />} />
        <Route path="cotizar/:id" element={<GestionCotizacion />} />
        <Route path="orden/:id" element={<OrdenCompra />} />
        <Route path="historial" element={<ComprasHistorial />} />
        <Route path="empleados" element={<ComprasPersonal />} />
        <Route path="proveedores" element={<ComprasProveedores />} />
      </Route>
    </Routes>
  );
}
