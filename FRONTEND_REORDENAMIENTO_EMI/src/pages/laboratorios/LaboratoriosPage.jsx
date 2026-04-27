// src/pages/laboratorios/LaboratoriosPage.jsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, MapPin, Building, Users, ArrowRight, LoaderCircle, AlertCircle, Search, X } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { fetchLaboratorios } from "../../api/laboratoriosApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalizeList = (data) => {
	if (!data) return [];
	// httpClient devuelve { data: { results: [...] } } o { data: [...] }
	const payload = data?.data ?? data;
	if (Array.isArray(payload)) return payload;
	return payload?.results ?? payload?.data ?? [];
};

const getLabName       = (l) => l?.nombre ?? l?.nombre_laboratorio ?? l?.descripcion ?? "Sin nombre";
const getSede          = (l) => l?.unidad_academica_nombre ?? l?.sede_nombre ?? l?.sede ?? l?.unidad_academica ?? "—";
const getEdificio      = (l) => l?.edificio ?? l?.nombre_edificio ?? "—";
const getSala          = (l) => l?.sala ?? l?.numero_sala ?? l?.aula ?? "—";
const getCapacidad     = (l) => l?.capacidad_estudiantes ?? l?.capacidad ?? l?.capacidad_equipos ?? l?.total_equipos ?? "—";
const getLabId         = (l) => l?.id ?? l?.uuid;

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
	const PAGE_SIZE = 20;

	// Debounce búsqueda
	useEffect(() => {
		const delay = setTimeout(() => {
			setDebouncedBusqueda(busqueda);
			setPagina(1); // Reset a primera página en nueva búsqueda
		}, 300);
		return () => clearTimeout(delay);
	}, [busqueda]);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["laboratorios", pagina, debouncedBusqueda],
		queryFn: () => fetchLaboratorios({
			page: pagina,
			page_size: PAGE_SIZE,
			...(debouncedBusqueda && { search: debouncedBusqueda }),
		}),
		keepPreviousData: true,
		staleTime: 2 * 60 * 1000,
	});

	const laboratorios = useMemo(() => normalizeList(data), [data]);
	const payload = data?.data ?? data;
	const totalCount = payload?.count ?? 0;
	const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

	/* ── Render ──────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Laboratorios"
			description="Consulta y evalúa los laboratorios de equipos disponibles por sede."
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

			{/* Buscador */}
			<div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
				<div style={{ position: "relative", width: "100%", maxWidth: "400px" }}>
					<Search size={18} color="#9ca3af" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
					<input
						type="text"
						placeholder="Buscar laboratorio, sede, edificio o sala..."
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						style={{
							width: "100%", padding: "10px 36px", fontSize: "14px",
							borderRadius: "10px", border: "1px solid #e5e7eb",
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
								{["Laboratorio", "Sede", "Edificio", "Sala", "Capacidad", "Acción"].map((col) => (
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
										{debouncedBusqueda ? (
											<>
												<Search size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
												<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151" }}>No se encontraron resultados</p>
												<p style={{ fontSize: "15px", color: "#9ca3af", marginTop: "6px" }}>No hay coincidencias para "{debouncedBusqueda}".</p>
												<button onClick={() => setBusqueda("")} style={{ marginTop: "12px", color: "#1d4ed8", fontSize: "14px", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }} className="hover:underline">Limpiar búsqueda</button>
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

									{/* Sede */}
									<td style={{ padding: "16px 20px" }}>
										<span style={{
											display: "inline-flex", alignItems: "center", gap: "6px",
											fontSize: "14px", fontWeight: 600, color: "#374151",
										}}>
											<MapPin size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
											{getSede(lab)}
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
