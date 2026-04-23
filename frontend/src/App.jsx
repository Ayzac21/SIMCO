import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

const Home = lazy(() => import("./Pages/Home.jsx"));
const Login = lazy(() => import("./Pages/login/Login.jsx"));

// --- URE (Solicitante) ---
const UreLayout = lazy(() => import("./Pages/Asistente/layout/UreLayout.jsx"));
const RequisicionesUre = lazy(() => import("./Pages/Asistente/RequisicionesUre.jsx"));
const UreDashboard = lazy(() => import("./Pages/Asistente/UreDashboard.jsx"));
const ListaRequisiciones = lazy(() => import("./Pages/Asistente/ListaRequisiciones.jsx"));
const EditarRequisicion = lazy(() => import("./Pages/Asistente/EditarRequisicion.jsx"));

// --- COORDINADOR ---
const CoorDashboard = lazy(() => import("./Pages/coordinador/dashboard/CoorDashboard.jsx"));
const CoordinadorLayout = lazy(() => import("./Pages/coordinador/layout/CoordinadorLayout.jsx"));
const Recibidas = lazy(() => import("./Pages/coordinador/requisiciones/Recibidas.jsx"));
const NuevaRequisicionCoor = lazy(() => import("./Pages/coordinador/requisiciones/NuevaRequisicionCoor.jsx"));
const EditarRequisicionCoor = lazy(() => import("./Pages/coordinador/requisiciones/EditarRequisicionCoor.jsx"));

// --- SECRETARÍA ---
const SecretariaLayout = lazy(() => import("./Pages/Secretaria/layout/SecretariaLayout.jsx"));
const SecDashboard = lazy(() => import("./Pages/Secretaria/dashboard/SecDashboard.jsx"));
const SecRecibidas = lazy(() => import("./Pages/Secretaria/SecRecibidas.jsx"));

// --- Compras ---
const ComprasLayout = lazy(() => import("./Pages/Compras/layout/ComprasLayout.jsx"));
const ComprasDashboard = lazy(() => import("./Pages/Compras/Dashboard/ComprasDashboard.jsx"));
const ComprasPreparacion = lazy(() => import("./Pages/Compras/preparacion/ComprasPreparacion.jsx"));
const GestionCotizacion = lazy(() => import("./Pages/Compras/cotizaciones/GestionCotizacion.jsx"));
const ComprasHistorial = lazy(() => import("./Pages/Compras/historial/ComprasHistorial.jsx"));
const ComprasPersonal = lazy(() => import("./Pages/Compras/personal/ComprasPersonal.jsx"));
const OrdenCompra = lazy(() => import("./Pages/Compras/orden/OrdenCompra.jsx"));
const ComprasRevision = lazy(() => import("./Pages/Compras/revision/ComprasRevision.jsx"));
const ComprasProveedores = lazy(() => import("./Pages/Compras/proveedores/ComprasProveedores.jsx"));
const ComprasUnidades = lazy(() => import("./Pages/Compras/unidades/ComprasUnidades.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Cargando...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Rutas de Unidad */}
        <Route
          path="/unidad"
          element={
            <ProtectedRoute allowedRoles={["head_office"]}>
              <UreLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<UreDashboard />} />
          <Route path="mi-requisiciones" element={<ListaRequisiciones />} />
          <Route path="requisiciones/nueva" element={<RequisicionesUre />} />
          <Route path="requisiciones/editar/:id" element={<EditarRequisicion />} />
        </Route>

        {/* Rutas de Coordinador */}
        <Route
          path="/coordinador"
          element={
            <ProtectedRoute allowedRoles={["coordinador"]}>
              <CoordinadorLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<CoorDashboard />} />
          <Route path="requisiciones" element={<Recibidas />} />
          <Route path="requisiciones/nueva" element={<NuevaRequisicionCoor />} />
          <Route path="requisiciones/editar/:id" element={<EditarRequisicionCoor />} />
        </Route>

        {/* Rutas de Secretaría */}
        <Route
          path="/secretaria"
          element={
            <ProtectedRoute allowedRoles={["secretaria"]}>
              <SecretariaLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<SecDashboard />} />
          <Route path="recibidas" element={<SecRecibidas />} />
          <Route path="mi-requisiciones" element={<ListaRequisiciones />} />
          <Route path="requisiciones/nueva" element={<RequisicionesUre />} />
          <Route path="requisiciones/editar/:id" element={<EditarRequisicion />} />
        </Route>

        {/* RUTAS DE COMPRAS */}
        <Route
          path="/compras"
          element={
            <ProtectedRoute allowedRoles={["compras_admin", "compras_operador", "compras_lector"]}>
              <ComprasLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<ComprasDashboard />} />
          <Route
            path="preparacion"
            element={
              <ProtectedRoute allowedRoles={["compras_admin"]}>
                <ComprasPreparacion />
              </ProtectedRoute>
            }
          />
          <Route path="cotizar/:id" element={<GestionCotizacion />} />
          <Route
            path="revision/:id"
            element={
              <ProtectedRoute allowedRoles={["compras_admin"]}>
                <ComprasRevision />
              </ProtectedRoute>
            }
          />
          <Route path="orden/:id" element={<OrdenCompra />} />
          <Route path="historial" element={<ComprasHistorial />} />
          <Route
            path="empleados"
            element={
              <ProtectedRoute allowedRoles={["compras_admin"]}>
                <ComprasPersonal />
              </ProtectedRoute>
            }
          />
          <Route
            path="proveedores"
            element={
              <ProtectedRoute allowedRoles={["compras_admin"]}>
                <ComprasProveedores />
              </ProtectedRoute>
            }
          />
          <Route
            path="unidades"
            element={
              <ProtectedRoute allowedRoles={["compras_admin"]}>
                <ComprasUnidades />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
