import React, { Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout";
import { RoleGuard } from "./components/auth";
import { ROLES } from "./constants/api";
import { useAuth } from "./store";

/* ── Code Splitting de Páginas ─────────────────────────────── */
const AnalyticsPage = React.lazy(() => import("./pages/laboratorios/AnalyticsPage"));
const ComparativaSedesPage = React.lazy(() => import("./pages/reordenamiento/ComparativaSedesPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const EvaluacionInsituPage = React.lazy(() => import("./pages/laboratorios/EvaluacionInsituPage"));
const ForbiddenPage = React.lazy(() => import("./pages/ForbiddenPage"));
const GuiaDetallePage = React.lazy(() => import("./pages/guias/GuiaDetallePage"));
const GuiaFormPage = React.lazy(() => import("./pages/guias/GuiaFormPage"));
const GuiasPage = React.lazy(() => import("./pages/guias/GuiasPage"));
const LaboratorioDetallePage = React.lazy(() => import("./pages/laboratorios/LaboratorioDetallePage"));
const LaboratoriosPage = React.lazy(() => import("./pages/laboratorios/LaboratoriosPage"));
const LoginPage = React.lazy(() => import("./pages/auth/LoginPage"));
const ReordenamientoFormPage = React.lazy(() => import("./pages/reordenamiento/ReordenamientoFormPage"));
const ReordenamientoListPage = React.lazy(() => import("./pages/reordenamiento/ReordenamientoListPage"));
const UsuariosPage = React.lazy(() => import("./pages/admin/UsuariosPage"));
const ConfiguracionPage = React.lazy(() => import("./pages/admin/ConfiguracionPage"));
const ReportesPage = React.lazy(() => import("./pages/reportes/ReportesPage"));
const EquiposPage = React.lazy(() => import("./pages/equipos/EquiposPage"));
const EquipoDetailPage = React.lazy(() => import("./pages/equipos/EquipoDetailPage"));

/* ── Helpers de Ruta Base ───────────────────────────────────── */
// Rutas que solo requieren estar autenticado (sin rol específico o roles base se manejan internamente)
function ProtectedRoute({ allowedRoles }) {
	const { isAuthenticated, isLoading, user } = useAuth();

	if (isLoading) {
		return <section className="p-6 text-sm text-slate-600">Verificando sesión...</section>;
	}

	if (!isAuthenticated) return <Navigate to="/login" replace />;

	if (allowedRoles && !allowedRoles.includes(user?.rol)) {
		return <ForbiddenPage />;
	}

	return <Outlet />;
}

function PublicRoute() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return <section className="p-6 text-sm text-slate-600">Verificando sesión...</section>;
	}

	if (isAuthenticated) return <Navigate to="/dashboard" replace />;

	return <Outlet />;
}

export default function App() {
	return (
		<Suspense fallback={
			<div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
					<span style={{ fontSize: '15px', fontWeight: 600, color: '#64748b' }}>Cargando módulo...</span>
				</div>
			</div>
		}>
			<Routes>
				{/* Público */}
				<Route path="/login" element={
					<PublicRoute>
						<LoginPage />
					</PublicRoute>
				} />
				
				<Route path="/login" element={<PublicRoute />} >
					<Route index element={<LoginPage />} />
				</Route>

				{/* Redirección raíz */}
				<Route path="/" element={<Navigate to="/dashboard" replace />} />

				{/* ── RUTAS PROTEGIDAS ─────────────────────────────────── */}
				<Route element={<ProtectedRoute />}>
					<Route element={<AppLayout />}>
						
						{/* Dashboard Base (para todos los autenticados) */}
						<Route path="/dashboard" element={<DashboardPage />} />

						{/* ── MÓDULO: Guías ─────────────────────────────────── */}
						<Route path="/guias">
							{/* Lista de guías: público autenticado */}
							<Route index element={<GuiasPage />} />
							{/* Creación y edición: solo admin, jefe */}
							<Route path="nueva" element={
								<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
									<GuiaFormPage />
								</RoleGuard>
							} />
							<Route path=":id/editar" element={
								<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
									<GuiaFormPage />
								</RoleGuard>
							} />
							{/* Detalle */}
							<Route path=":id" element={<GuiaDetallePage />} />
						</Route>

						{/* ── MÓDULO: Laboratorios ───────────────────────────── */}
						<Route path="/laboratorios" element={
							<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS]}>
								<Outlet />
							</RoleGuard>
						}>
							<Route index element={<LaboratoriosPage />} />
							<Route path=":id" element={<LaboratorioDetallePage />} />
							{/* Sub/Analytics */}
							<Route path=":id/analytics" element={<AnalyticsPage />} />
						</Route>

						{/* Equipo Especifico (Evaluación In-situ) */}
						<Route path="/equipos/:id/evaluacion" element={
							<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.ENCARGADO_ACTIVOS]}>
								<EvaluacionInsituPage />
							</RoleGuard>
						} />

						{/* ── MÓDULO: Equipos (Explorador) ────────────────────── */}
						<Route path="/equipos" element={
							<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS]}>
								<Outlet />
							</RoleGuard>
						}>
							<Route index element={<EquiposPage />} />
							<Route path=":id" element={<EquipoDetailPage />} />
						</Route>

						{/* ── MÓDULO: Reordenamientos (Sedes) ───────────────── */}
						<Route path="/reordenamientos" element={
							<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
								<Outlet />
							</RoleGuard>
						}>
							<Route index element={<ReordenamientoListPage />} />
							<Route path="nuevo" element={
								// Exclusivo para originar traslados
								<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
									<ReordenamientoFormPage />
								</RoleGuard>
							} />
							<Route path="comparativa" element={
								<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
									<ComparativaSedesPage />
								</RoleGuard>
							} />
						</Route>

						{/* ── MÓDULO: Reportes ───────────────────────────────── */}
						<Route path="/reportes" element={
							<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.JEFE]}>
								<ReportesPage />
							</RoleGuard>
						} />

						{/* ── MÓDULO: Administración ─────────────────────────── */}
						<Route path="/admin">
							<Route path="usuarios" element={
								<RoleGuard allowedRoles={[ROLES.ADMIN]}>
									<UsuariosPage />
								</RoleGuard>
							} />
							<Route path="configuracion" element={
								<RoleGuard allowedRoles={[ROLES.ADMIN]}>
									<ConfiguracionPage />
								</RoleGuard>
							} />
						</Route>

					</Route>
				</Route>

				{/* catch-all */}
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</Suspense>
	);
}