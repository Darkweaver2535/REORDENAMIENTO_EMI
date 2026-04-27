// src/pages/laboratorios/LaboratoriosPage.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, MapPin, Building, Users, ArrowRight, LoaderCircle, AlertCircle } from "lucide-react";
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

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["laboratorios"],
		queryFn: () => fetchLaboratorios(),
		staleTime: 2 * 60 * 1000,
	});

	const laboratorios = useMemo(() => normalizeList(data), [data]);

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
										<FlaskConical size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
										<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151" }}>
											No hay laboratorios registrados
										</p>
										<p style={{ fontSize: "15px", color: "#9ca3af", marginTop: "6px" }}>
											Contacta al administrador para registrar laboratorios.
										</p>
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

				{/* Footer count */}
				{!isLoading && laboratorios.length > 0 && (
					<div style={{
						padding: "12px 20px",
						backgroundColor: "#f9fafb",
						borderTop: "1px solid #f3f4f6",
					}}>
						<p style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
							{laboratorios.length} laboratorio{laboratorios.length === 1 ? "" : "s"} registrado{laboratorios.length === 1 ? "" : "s"}
						</p>
					</div>
				)}
			</div>
		</PageWrapper>
	);
}
