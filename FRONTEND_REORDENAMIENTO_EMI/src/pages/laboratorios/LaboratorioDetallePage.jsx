// src/pages/laboratorios/LaboratorioDetallePage.jsx
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical, Wrench, ClipboardCheck } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { fetchLaboratorioById, fetchEquipos } from "../../api/laboratoriosApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import Button from "../../components/ui/Button";
import ModalEvaluacionInsitu from "../../components/laboratorios/ModalEvaluacionInsitu";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize  = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const unwrap     = (d) => d?.data ?? d;
const safe       = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const getId      = (e) => e?.id ?? e?.uuid ?? e?.codigo_activo;
const getCode    = (e) => e?.codigo_activo ?? e?.codigo ?? e?.serial ?? "—";
const getName    = (e) => e?.nombre ?? e?.nombre_equipo ?? e?.descripcion ?? "Equipo";
const getUltEval = (e) => {
	const d = e?.ultima_evaluacion ?? e?.last_evaluation ?? e?.evaluacion_fecha;
	if (!d) return "Sin evaluación";
	return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
};

/* ── Página principal ────────────────────────────────────────── */
export default function LaboratorioDetallePage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { hasRole } = useAuth();
	const [evaluandoEquipo, setEvaluandoEquipo] = useState(null);

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.DECANO, ROLES.ENCARGADO_ACTIVOS)) {
		return <Navigate to="/dashboard" replace />;
	}

	/* ── Queries ──────────────────────────────────────────────── */
	const { data: labData, isLoading: loadingLab } = useQuery({
		queryKey: ["laboratorio", id],
		queryFn: () => fetchLaboratorioById(id),
		enabled: Boolean(id),
	});

	const { data: equiposData, isLoading: loadingEquipos } = useQuery({
		queryKey: ["equipos", id],
		queryFn: () => fetchEquipos({ laboratorio_id: id }),
		enabled: Boolean(id),
	});

	const lab     = useMemo(() => unwrap(labData),        [labData]);
	const equipos = useMemo(() => normalize(equiposData), [equiposData]);

	const labName = lab?.nombre ?? lab?.nombre_laboratorio ?? "Laboratorio";
	const sede    = lab?.unidad_academica_nombre ?? lab?.sede ?? "—";

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<>
			<PageWrapper
				title={loadingLab ? "Cargando..." : labName}
				description={
					loadingLab ? "" :
					`Sede: ${sede} · ${equipos.length} equipo${equipos.length === 1 ? "" : "s"} registrado${equipos.length === 1 ? "" : "s"}`
				}
				actions={
					<Button variant="secondary" onClick={() => navigate("/laboratorios")}>
						<ArrowLeft size={18} />
						Volver
					</Button>
				}
			>
				{/* ── Info del laboratorio ─────────────────────── */}
				{!loadingLab && lab && (
					<div style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
						gap: "16px",
						marginBottom: "28px",
					}}>
						{[
							{ label: "Sede",        value: lab?.unidad_academica_nombre ?? lab?.sede ?? "—" },
							{ label: "Edificio",    value: lab?.edificio  ?? "—" },
							{ label: "Sala",        value: lab?.sala ?? lab?.aula ?? "—" },
							{ label: "Capacidad",   value: lab?.capacidad ?? lab?.capacidad_equipos ?? "—" },
							{ label: "Responsable", value: lab?.responsable ?? "—" },
						].map(({ label, value }) => (
							<div
								key={label}
								style={{
									backgroundColor: "#fff", border: "1px solid #e5e7eb",
									borderRadius: "12px", padding: "16px 20px",
									boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
								}}
							>
								<p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>
									{label}
								</p>
								<p style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>{value}</p>
							</div>
						))}
					</div>
				)}

				{/* ── Tabla de equipos ──────────────────────────── */}
				<div style={{
					backgroundColor: "#fff", border: "1px solid #e5e7eb",
					borderRadius: "14px", overflow: "hidden",
					boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
				}}>
					<div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "10px" }}>
						<Wrench size={18} color="#002B5E" />
						<h2 style={{ fontSize: "16px", fontWeight: 700, color: "#374151" }}>Equipos del laboratorio</h2>
					</div>

					<div style={{ overflowX: "auto" }}>
						<table style={{ minWidth: "750px", borderCollapse: "collapse", width: "100%" }}>
							<thead>
								<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
									{["Código", "Equipo", "Disponibles", "Malos", "Total", "Última Evaluación", "Acción"].map((h) => (
										<th
											key={h}
											style={{ padding: "13px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>

								{/* Skeleton */}
								{loadingEquipos && [1, 2, 3, 4].map((i) => (
									<tr key={i}>
										{[1, 2, 3, 4, 5, 6, 7].map((j) => (
											<td key={j} style={{ padding: "16px 20px" }}>
												<div style={{ height: "14px", borderRadius: "6px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
											</td>
										))}
									</tr>
								))}

								{/* Empty */}
								{!loadingEquipos && equipos.length === 0 && (
									<tr>
										<td colSpan={7} style={{ padding: "56px 24px", textAlign: "center" }}>
											<FlaskConical size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
											<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151" }}>Sin equipos registrados</p>
										</td>
									</tr>
								)}

								{/* Filas */}
								{!loadingEquipos && equipos.map((eq, idx) => {
									const disponibles = safe(eq?.cantidad_disponible ?? eq?.disponible ?? eq?.buenas);
									const malos       = safe(eq?.malas ?? eq?.cantidad_mala);
									const total       = safe(eq?.cantidad_total ?? eq?.total ?? eq?.cantidad);

									return (
										<tr
											key={getId(eq) ?? idx}
											style={{ borderBottom: idx < equipos.length - 1 ? "1px solid #f3f4f6" : "none" }}
											className="hover:bg-gray-50"
										>
											<td style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 700, color: "#6b7280", fontFamily: "monospace" }}>
												{getCode(eq)}
											</td>
											<td style={{ padding: "16px 20px" }}>
												<p style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{getName(eq)}</p>
												{eq?.ubicacion_actual && (
													<p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "2px" }}>{eq.ubicacion_actual}</p>
												)}
											</td>
											<td style={{ padding: "16px 20px" }}>
												<span style={{
													display: "inline-flex", alignItems: "center", justifyContent: "center",
													minWidth: "36px", height: "28px", borderRadius: "6px", padding: "0 10px",
													backgroundColor: "#f0fdf4", color: "#15803d",
													fontSize: "14px", fontWeight: 700,
												}}>
													{disponibles}
												</span>
											</td>
											<td style={{ padding: "16px 20px" }}>
												<span style={{
													display: "inline-flex", alignItems: "center", justifyContent: "center",
													minWidth: "36px", height: "28px", borderRadius: "6px", padding: "0 10px",
													backgroundColor: malos > 0 ? "#fef2f2" : "#f9fafb",
													color: malos > 0 ? "#b91c1c" : "#9ca3af",
													fontSize: "14px", fontWeight: 700,
												}}>
													{malos}
												</span>
											</td>
											<td style={{ padding: "16px 20px", fontSize: "15px", fontWeight: 700, color: "#374151" }}>
												{total || "—"}
											</td>
											<td style={{ padding: "16px 20px", fontSize: "14px", color: "#6b7280", fontWeight: 500 }}>
												{getUltEval(eq)}
											</td>
											<td style={{ padding: "16px 20px" }}>
												{(() => {
													const evaluadoEn = eq?.evaluado_en ?? eq?.evaluacion_fecha ?? eq?.ultima_evaluacion;
													const yaEvaluado = !!evaluadoEn;

													return (
														<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
															<button
																onClick={() => setEvaluandoEquipo(eq)}
																style={{
																	display: "inline-flex", alignItems: "center", gap: "7px",
																	padding: "8px 14px", borderRadius: "8px",
																	backgroundColor: yaEvaluado ? "#dcfce7" : "#2b5ea5",
																	border: yaEvaluado ? "1px solid #22c55e" : "1px solid #2b5ea5",
																	color: yaEvaluado ? "#166534" : "#ffffff",
																	fontSize: "14px", fontWeight: 700,
																	cursor: "pointer", whiteSpace: "nowrap",
																}}
																className={yaEvaluado ? "hover:bg-green-200" : "hover:bg-blue-800"}
															>
																<ClipboardCheck size={15} />
																{yaEvaluado ? "✓ Evaluado" : "Evaluar"}
															</button>
															
															{yaEvaluado && (
																<span className="text-xs text-green-600 font-medium whitespace-nowrap">
																	{new Date(evaluadoEn).toLocaleDateString("es-BO", {
																		day: "2-digit",
																		month: "short",
																		year: "numeric",
																		hour: "2-digit",
																		minute: "2-digit"
																	})}
																</span>
															)}
														</div>
													);
												})()}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			</PageWrapper>

			{/* ── Modal evaluación in-situ ──────────────────── */}
			<ModalEvaluacionInsitu
				isOpen={Boolean(evaluandoEquipo)}
				equipo={evaluandoEquipo}
				queryKey={["equipos", id]}
				onClose={() => setEvaluandoEquipo(null)}
			/>
		</>
	);
}
