// src/pages/laboratorios/LaboratoriosPage.jsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, MapPin, Building, Users, ArrowRight, AlertCircle, Search, X } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { fetchLaboratorios } from "../../api/laboratoriosApi";
import { ROLES, API_ROUTES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";
import axiosClient from "../../api/httpClient";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalizeList = (data) => {
	if (!data) return [];
	const payload = data?.data ?? data;
	if (Array.isArray(payload)) return payload;
	return payload?.results ?? payload?.data ?? [];
};

const getLabName        = (l) => l?.nombre ?? l?.nombre_laboratorio ?? l?.descripcion ?? "Sin nombre";
const getUnidadAcademica = (l) => l?.unidad_academica_nombre ?? l?.sede_nombre ?? l?.sede ?? l?.unidad_academica ?? "—";
const getEdificio       = (l) => l?.edificio ?? l?.nombre_edificio ?? "—";
const getSala           = (l) => l?.sala ?? l?.numero_sala ?? l?.aula ?? "—";
const getCapacidad      = (l) => l?.capacidad_estudiantes ?? l?.capacidad ?? l?.capacidad_equipos ?? l?.total_equipos ?? "—";
const getLabId          = (l) => l?.id ?? l?.uuid;

/* ── Styles ──────────────────────────────────────────────────── */
const selectStyle = {
	height: 42, padding: "0 34px 0 14px", fontSize: 14, fontWeight: 600,
	borderRadius: 10, border: "1px solid #e5e7eb", backgroundColor: "#fff",
	color: "#374151", outline: "none", appearance: "none", cursor: "pointer",
	backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
	backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
	transition: "border-color 150ms ease",
	minWidth: 0,
};


/* ── Skeleton ────────────────────────────────────────────────── */
function RowSkeleton() {
	return (
		<tr>
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<td key={i} style={{ padding: "16px 20px" }}>
					<div style={{ height: "16px", borderRadius: "6px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
				</td>
			))}
		</tr>
	);
}

/* ── Componente principal ────────────────────────────────────── */
export default function LaboratoriosPage() {
	const navigate = useNavigate();
	const { hasRole } = useAuth();

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS)) {
		return <Navigate to="/dashboard" replace />;
	}

	const [busqueda, setBusqueda] = useState("");
	const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
	const [pagina, setPagina] = useState(1);
	const [filtroUA, setFiltroUA] = useState("");
	const [filtroDepto, setFiltroDepto] = useState("");
	const PAGE_SIZE = 20;

	// Fetch unidades académicas for filter dropdown
	const { data: uaData } = useQuery({
		queryKey: ["unidades-academicas-filtro"],
		queryFn: () => axiosClient.get(API_ROUTES.ESTRUCTURA.UNIDADES),
		staleTime: 10 * 60 * 1000,
	});
	const unidades = useMemo(() => normalizeList(uaData), [uaData]);

	// Fetch departamentos for filter dropdown
	const { data: deptoData } = useQuery({
		queryKey: ["departamentos-filtro"],
		queryFn: () => axiosClient.get(API_ROUTES.ESTRUCTURA.DEPARTAMENTOS),
		staleTime: 10 * 60 * 1000,
	});
	const todosDeptos = useMemo(() => normalizeList(deptoData), [deptoData]);

	// Cascade: if UA selected, only show deptos linked to that UA
	const deptosVisibles = useMemo(() => {
		if (!filtroUA) return todosDeptos;
		return todosDeptos.filter(d => {
			// M2M: unidades_academicas es un array de { id, nombre, ... }
			if (Array.isArray(d.unidades_academicas)) {
				return d.unidades_academicas.some(ua => String(ua.id) === String(filtroUA));
			}
			// Legacy FK fallback
			return String(d.unidad_academica_id ?? d.unidad_academica ?? "") === String(filtroUA);
		});
	}, [todosDeptos, filtroUA]);

	// Debounce búsqueda
	useEffect(() => {
		const delay = setTimeout(() => {
			setDebouncedBusqueda(busqueda);
			setPagina(1);
		}, 300);
		return () => clearTimeout(delay);
	}, [busqueda]);

	// Reset page and cascaded filters when parent filters change
	useEffect(() => { setPagina(1); }, [filtroUA, filtroDepto]);
	// Reset depto when UA changes (cascade)
	useEffect(() => { setFiltroDepto(""); }, [filtroUA]);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["laboratorios", pagina, debouncedBusqueda, filtroUA],
		queryFn: () => fetchLaboratorios({
			page: pagina,
			page_size: PAGE_SIZE,
			...(debouncedBusqueda && { search: debouncedBusqueda }),
			...(filtroUA && { unidad_id: filtroUA }),
		}),
		keepPreviousData: true,
		staleTime: 2 * 60 * 1000,
	});

	const laboratorios = useMemo(() => normalizeList(data), [data]);
	const payload = data?.data ?? data;
	const totalCount = payload?.count ?? 0;
	const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

	const hasActiveFilters = filtroUA || filtroDepto || debouncedBusqueda;

	const clearAll = () => {
		setBusqueda("");
		setFiltroUA("");
		setFiltroDepto("");
	};

	/* ── Render ──────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Laboratorios"
			description="Consulta y evalúa los laboratorios de equipos disponibles por unidad académica."
		>
			{/* Error */}
			{isError && (
				<div style={{
					display: "flex", alignItems: "center", gap: "12px",
					padding: "16px 20px", borderRadius: "12px",
					backgroundColor: "#fef2f2", border: "1px solid #fecaca",
					marginBottom: "24px",
				}}>
					<AlertCircle size={20} color="#ef4444" />
					<p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>
						No se pudieron cargar los laboratorios.{" "}
						<span style={{ fontWeight: 500 }}>{error?.message ?? "Verifica tu conexión."}</span>
					</p>
				</div>
			)}

			{/* ── Filtros ─────────────────────────────────────── */}
			<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
				{/* UA Dropdown */}
				<select
					id="filtro-ua"
					value={filtroUA}
					onChange={(e) => setFiltroUA(e.target.value)}
					style={{ ...selectStyle, minWidth: 200 }}
				>
					<option value="">Todas las U.A.</option>
					{unidades.map((u) => (
						<option key={u.id} value={u.id}>{u.nombre}</option>
					))}
				</select>

				{/* Departamento Dropdown */}
				<select
					id="filtro-depto"
					value={filtroDepto}
					onChange={(e) => setFiltroDepto(e.target.value)}
					style={{ ...selectStyle, minWidth: 200 }}
				>
					<option value="">Todos los Deptos.</option>
					{deptosVisibles.map((d) => (
						<option key={d.id} value={d.id}>{d.nombre}</option>
					))}
				</select>

				{/* Search */}
				<div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 400 }}>
					<Search size={18} color="#9ca3af" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
					<input
						type="text"
						placeholder="Buscar laboratorio..."
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						style={{
							width: "100%", height: 42, padding: "0 36px", fontSize: 14,
							borderRadius: 10, border: "1px solid #e5e7eb",
							outline: "none", boxSizing: "border-box",
							transition: "border-color 150ms ease",
						}}
						className="focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
					/>
					{busqueda && (
						<button
							onClick={() => setBusqueda("")}
							style={{
								position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
								border: "none", background: "transparent", cursor: "pointer",
								display: "flex", alignItems: "center", justifyContent: "center",
								padding: "4px", color: "#9ca3af"
							}}
							className="hover:text-gray-700"
						>
							<X size={16} />
						</button>
					)}
				</div>
			</div>

			{/* Tabla */}
			<div style={{
				backgroundColor: "#ffffff",
				border: "1px solid #e5e7eb",
				borderRadius: "14px",
				overflow: "hidden",
				boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
			}}>
				<div style={{ overflowX: "auto" }}>
					<table style={{ minWidth: "700px", borderCollapse: "collapse", width: "100%" }}>

						{/* Head */}
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								{["Laboratorio", "Unidad Académica", "Edificio", "Sala", "Capacidad", "Acción"].map((col) => (
									<th
										key={col}
										style={{
											padding: "14px 20px",
											textAlign: "left",
											fontSize: "12px",
											fontWeight: 700,
											color: "#9ca3af",
											textTransform: "uppercase",
											letterSpacing: "0.12em",
											whiteSpace: "nowrap",
										}}
									>
										{col}
									</th>
								))}
							</tr>
						</thead>

						{/* Body */}
						<tbody>
							{isLoading && [1, 2, 3, 4].map((i) => <RowSkeleton key={i} />)}

							{!isLoading && laboratorios.length === 0 && (
								<tr>
									<td colSpan={6} style={{ padding: "64px 24px", textAlign: "center" }}>
										{hasActiveFilters ? (
											<>
												<Search size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
												<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151" }}>No se encontraron resultados</p>
												<p style={{ fontSize: "15px", color: "#9ca3af", marginTop: "6px" }}>
													Prueba ajustando los filtros o la búsqueda.
												</p>
												<button onClick={clearAll} style={{ marginTop: "12px", color: "#1d4ed8", fontSize: "14px", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }} className="hover:underline">Limpiar filtros</button>
											</>
										) : (
											<>
												<FlaskConical size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
												<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151" }}>No hay laboratorios registrados</p>
												<p style={{ fontSize: "15px", color: "#9ca3af", marginTop: "6px" }}>Contacta al administrador para registrar laboratorios.</p>
											</>
										)}
									</td>
								</tr>
							)}

							{!isLoading && laboratorios.map((lab, idx) => (
								<tr
									key={getLabId(lab) ?? idx}
									style={{
										borderBottom: idx < laboratorios.length - 1 ? "1px solid #f3f4f6" : "none",
										transition: "background-color 150ms ease",
									}}
									className="hover:bg-gray-50"
								>
									{/* Nombre */}
									<td style={{ padding: "16px 20px" }}>
										<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
											<div style={{
												width: "38px", height: "38px", borderRadius: "10px",
												backgroundColor: "#EFF6FF", display: "flex",
												alignItems: "center", justifyContent: "center", flexShrink: 0,
											}}>
												<FlaskConical size={18} color="#002B5E" />
											</div>
											<div>
												<p style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>
													{getLabName(lab)}
												</p>
												{lab?.responsable && (
													<p style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500, marginTop: "2px" }}>
														{lab.responsable}
													</p>
												)}
											</div>
										</div>
									</td>

									{/* Unidad Académica */}
									<td style={{ padding: "16px 20px" }}>
										<span style={{
											display: "inline-flex", alignItems: "center", gap: "6px",
											fontSize: "14px", fontWeight: 600, color: "#374151",
										}}>
											<MapPin size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
											{getUnidadAcademica(lab)}
										</span>
									</td>

									{/* Edificio */}
									<td style={{ padding: "16px 20px" }}>
										<span style={{
											display: "inline-flex", alignItems: "center", gap: "6px",
											fontSize: "14px", fontWeight: 500, color: "#6b7280"
										}}>
											<Building size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
											{getEdificio(lab)}
										</span>
									</td>

									{/* Sala */}
									<td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>
										{getSala(lab)}
									</td>

									{/* Capacidad */}
									<td style={{ padding: "16px 20px" }}>
										<span style={{
											display: "inline-flex", alignItems: "center", gap: "6px",
											fontSize: "14px", fontWeight: 600, color: "#374151",
										}}>
											<Users size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
											{getCapacidad(lab)}
										</span>
									</td>

									{/* Acción */}
									<td style={{ padding: "16px 20px" }}>
										<button
											onClick={() => navigate(`/laboratorios/${getLabId(lab)}`)}
											style={{
												display: "inline-flex", alignItems: "center", gap: "8px",
												padding: "8px 16px", borderRadius: "8px",
												backgroundColor: "#002B5E", color: "#ffffff",
												fontSize: "14px", fontWeight: 700,
												border: "none", cursor: "pointer",
												boxShadow: "0 2px 6px rgba(0,43,94,0.25)",
												transition: "opacity 150ms ease",
												whiteSpace: "nowrap",
											}}
											className="hover:opacity-85"
										>
											Ver equipos
											<ArrowRight size={15} />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Footer count y Paginación */}
				{!isLoading && (
					<div style={{
						padding: "16px 20px",
						backgroundColor: "#f9fafb",
						borderTop: "1px solid #f3f4f6",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: "16px"
					}}>
						<p style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280" }}>
							{totalCount} laboratorio{totalCount === 1 ? "" : "s"} registrado{totalCount === 1 ? "" : "s"}
						</p>
						
						{totalPages > 1 && (
							<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
								<button 
									onClick={() => setPagina(p => p - 1)} 
									disabled={pagina === 1}
									style={{ padding: "6px 12px", fontSize: "13px", fontWeight: 600, border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", cursor: pagina === 1 ? "not-allowed" : "pointer", opacity: pagina === 1 ? 0.5 : 1 }}
									className="hover:bg-gray-50"
								>
									← Anterior
								</button>
								<span style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280" }}>
									Página {pagina} de {totalPages}
								</span>
								<button 
									onClick={() => setPagina(p => p + 1)} 
									disabled={pagina === totalPages}
									style={{ padding: "6px 12px", fontSize: "13px", fontWeight: 600, border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", cursor: pagina === totalPages ? "not-allowed" : "pointer", opacity: pagina === totalPages ? 0.5 : 1 }}
									className="hover:bg-gray-50"
								>
									Siguiente →
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</PageWrapper>
	);
}
