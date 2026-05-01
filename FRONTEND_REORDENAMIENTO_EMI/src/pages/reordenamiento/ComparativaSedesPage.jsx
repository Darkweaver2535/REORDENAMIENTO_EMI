// src/pages/reordenamiento/ComparativaSedesPage.jsx
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
	Search, BarChart2, ArrowRightLeft,
	LoaderCircle, AlertCircle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { fetchComparativaSedes } from "../../api/reordenamientoApi";
import { useAuth } from "../../store/AuthContext";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize    = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.sedes ?? p?.data ?? []; };
const safe         = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const getUnidadNombre = (s) => s?.sede ?? s?.nombre_sede ?? s?.sede_nombre ?? s?.nombre ?? "Unidad Académica";
const getDisp      = (s) => safe(s?.disponibles ?? s?.cantidad_disponible ?? s?.disponible);
const getReq       = (s) => safe(s?.requerido ?? s?.cantidad_requerida ?? s?.requeridos);
const getRatio     = (s) => { const req = getReq(s); return req > 0 ? getDisp(s) / req : getDisp(s) > 0 ? 2 : 0; };
const getDeficit   = (s) => Math.max(getReq(s) - getDisp(s), 0);
const getExcedente = (s) => Math.max(getDisp(s) - getReq(s), 0);

/* ── Colores según ratio ─────────────────────────────────────── */
function getRatioConfig(ratio) {
	if (ratio >= 1)   return { bar: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", label: "Suficiente",    icon: TrendingUp };
	if (ratio >= 0.6) return { bar: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#92400e", label: "Ajustado",      icon: Minus };
	return              { bar: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", label: "Insuficiente",  icon: TrendingDown };
}

/* ── Tarjeta de sede ─────────────────────────────────────────── */
function SedeCard({ sede, maxDisp, maxReq }) {
	const ratio      = getRatio(sede);
	const disponibles = getDisp(sede);
	const requerido   = getReq(sede);
	const deficit     = getDeficit(sede);
	const excedente   = getExcedente(sede);
	const config      = getRatioConfig(ratio);
	const Icon        = config.icon;

	// Ancho de la barra: relativo al máximo de la lista para comparar visualmente
	const barWidth = maxDisp > 0 ? Math.min((disponibles / maxDisp) * 100, 100) : 0;
	// Barra de referencia (requerido)
	const reqWidth = maxDisp > 0 ? Math.min((requerido / maxDisp) * 100, 100) : 0;

	return (
		<div style={{
			backgroundColor: "#fff",
			border: `1px solid ${config.border}`,
			borderRadius: "14px",
			padding: "24px",
			boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
			transition: "box-shadow 200ms ease",
		}}
			className="hover:shadow-md"
		>
			{/* Header */}
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
				<div>
					<h3 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
						{getUnidadNombre(sede)}
					</h3>
					{sede?.unidad_academica && (
						<p style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500, marginTop: "3px" }}>
							{sede.unidad_academica}
						</p>
					)}
				</div>

				{/* Badge estado */}
				<span style={{
					display: "inline-flex", alignItems: "center", gap: "5px",
					padding: "5px 12px", borderRadius: "8px",
					backgroundColor: config.bg, border: `1px solid ${config.border}`,
					color: config.text, fontSize: "12px", fontWeight: 700,
				}}>
					<Icon size={13} />
					{config.label}
				</span>
			</div>

			{/* Métricas */}
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
				<div style={{ textAlign: "center" }}>
					<p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
						Disponibles
					</p>
					<p style={{ fontSize: "26px", fontWeight: 800, color: config.bar, lineHeight: 1 }}>
						{disponibles}
					</p>
				</div>
				<div style={{ textAlign: "center" }}>
					<p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
						Requeridos
					</p>
					<p style={{ fontSize: "26px", fontWeight: 800, color: "#374151", lineHeight: 1 }}>
						{requerido}
					</p>
				</div>
				<div style={{ textAlign: "center" }}>
					<p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
						{deficit > 0 ? "Déficit" : "Excedente"}
					</p>
					<p style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1, color: deficit > 0 ? "#dc2626" : "#16a34a" }}>
						{deficit > 0 ? `−${deficit}` : excedente > 0 ? `+${excedente}` : "="}
					</p>
				</div>
			</div>

			{/* Barra visual doble */}
			<div>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
					<span style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>Disponibles</span>
					<span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
						{requerido > 0 ? `${Math.round(ratio * 100)}%` : "—"}
					</span>
				</div>

				{/* Barra de fondo (requeridos) */}
				<div style={{ position: "relative", height: "12px", borderRadius: "8px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
					{/* Línea de referencia de requeridos */}
					{requerido > 0 && (
						<div style={{
							position: "absolute", left: 0, top: 0, height: "100%",
							width: `${reqWidth}%`,
							backgroundColor: "#e5e7eb",
							borderRadius: "8px",
						}} />
					)}
					{/* Barra de disponibles */}
					<div style={{
						position: "absolute", left: 0, top: 0, height: "100%",
						width: `${barWidth}%`,
						backgroundColor: config.bar,
						borderRadius: "8px",
						transition: "width 600ms ease",
					}} />
				</div>

				<div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
					<span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>0</span>
					<span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
						Max: {Math.max(disponibles, requerido, maxDisp)}
					</span>
				</div>
			</div>
		</div>
	);
}

/* ── Componente principal ────────────────────────────────────── */
export default function ComparativaSedesPage() {
	const navigate = useNavigate();
	const { hasRole } = useAuth();
	const inputRef = useRef(null);

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) {
		return <Navigate to="/dashboard" replace />;
	}

	const [query, setQuery]           = useState("");
	const [searchTerm, setSearchTerm] = useState(""); // solo se actualiza al buscar

	const { data, isLoading, isFetching, isError, error } = useQuery({
		queryKey: ["comparativa-sedes", searchTerm],
		queryFn: () => fetchComparativaSedes(searchTerm),
		enabled: Boolean(searchTerm),
		staleTime: 30 * 1000,
	});

	const sedes = useMemo(() => normalize(data), [data]);

	/* ── Calcular máximos para escalar barras relativamente ─── */
	const maxDisp = useMemo(() => Math.max(...sedes.map(getDisp), 1), [sedes]);
	const maxReq  = useMemo(() => Math.max(...sedes.map(getReq), 1),  [sedes]);

	/* ── Sede con mayor excedente (posible origen de traslado) ─ */
	const bestOrigen  = useMemo(() => sedes.reduce((best, s) => getExcedente(s) > getExcedente(best ?? {}) ? s : best, null), [sedes]);
	const bestDestino = useMemo(() => sedes.reduce((best, s) => getDeficit(s)   > getDeficit(best ?? {})   ? s : best, null), [sedes]);

	const handleSearch = () => {
		const q = query.trim();
		if (q) setSearchTerm(q);
	};

	const loading = isLoading || isFetching;

	return (
		<PageWrapper
			title="Comparativa por Unidades Académicas"
			description="Detecta desproporciones de equipos y justifica reordenamientos entre unidades académicas."
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

				{/* ── Buscador ─────────────────────────────────── */}
				<div style={{
					backgroundColor: "#fff",
					border: "1px solid #e5e7eb",
					borderRadius: "14px",
					padding: "24px 28px",
					boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
				}}>
					<label
						htmlFor="search-equipo"
						style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "10px" }}
					>
						Buscar por nombre de equipo
					</label>
					<div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
						<div style={{ position: "relative", flex: 1 }}>
							<Search
								size={18}
								color="#9ca3af"
								style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
							/>
							<input
								id="search-equipo"
								ref={inputRef}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
								placeholder='Ej: "Balanza analítica", "Microscopio"...'
								style={{
									width: "100%", height: "48px", borderRadius: "10px",
									border: "1px solid #d1d5db", backgroundColor: "#fff",
									paddingLeft: "46px", paddingRight: "16px",
									fontSize: "16px", fontWeight: 500, color: "#111827",
									outline: "none",
								}}
							/>
						</div>
						<button
							onClick={handleSearch}
							disabled={!query.trim() || loading}
							style={{
								display: "inline-flex", alignItems: "center", gap: "8px",
								height: "48px", padding: "0 24px", borderRadius: "10px",
								backgroundColor: !query.trim() ? "#e5e7eb" : "#002B5E",
								color: !query.trim() ? "#9ca3af" : "#fff",
								fontSize: "15px", fontWeight: 700, border: "none",
								cursor: !query.trim() || loading ? "not-allowed" : "pointer",
								boxShadow: query.trim() ? "0 4px 6px rgba(0,43,94,0.25)" : "none",
								transition: "all 200ms ease",
								flexShrink: 0,
							}}
						>
							{loading
								? <><LoaderCircle size={17} className="animate-spin" />Buscando...</>
								: <><Search size={17} />Buscar</>
							}
						</button>
					</div>

					{searchTerm && (
						<p style={{ marginTop: "10px", fontSize: "13px", color: "#9ca3af", fontWeight: 500 }}>
							Mostrando resultados para: <strong style={{ color: "#374151" }}>"{searchTerm}"</strong>
							{" · "}
							<button
								onClick={() => { setQuery(""); setSearchTerm(""); }}
								style={{ background: "none", border: "none", color: "#002B5E", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}
							>
								Limpiar
							</button>
						</p>
					)}
				</div>

				{/* ── Error ────────────────────────────────────── */}
				{isError && (
					<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
						<AlertCircle size={20} color="#ef4444" />
						<p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>
							{error?.response?.data?.detail ?? "No se pudieron cargar los datos. Intenta de nuevo."}
						</p>
					</div>
				)}

				{/* ── Empty state inicial ───────────────────────── */}
				{!searchTerm && !loading && (
					<div style={{
						display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
						padding: "64px 32px", backgroundColor: "#fff",
						border: "2px dashed #e5e7eb", borderRadius: "14px", textAlign: "center",
					}}>
						<BarChart2 size={48} color="#d1d5db" style={{ marginBottom: "16px" }} />
						<h3 style={{ fontSize: "18px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
							Busca un tipo de equipo
						</h3>
						<p style={{ fontSize: "15px", color: "#9ca3af", fontWeight: 500, maxWidth: "380px" }}>
							Escribe el nombre del equipo que quieres comparar entre las distintas unidades académicas y presiona "Buscar".
						</p>
					</div>
				)}

				{/* ── Skeleton mientras carga ───────────────────── */}
				{loading && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
						{[1, 2, 3, 4, 5].map((i) => (
							<div key={i} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px" }}>
								<div style={{ height: "20px", borderRadius: "6px", backgroundColor: "#f3f4f6", marginBottom: "12px", width: "60%" }} className="animate-pulse" />
								<div style={{ height: "14px", borderRadius: "6px", backgroundColor: "#f3f4f6", marginBottom: "20px", width: "40%" }} className="animate-pulse" />
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
									{[1, 2, 3].map((j) => (
										<div key={j} style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
									))}
								</div>
								<div style={{ height: "12px", borderRadius: "6px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
							</div>
						))}
					</div>
				)}

				{/* ── Sin resultados ────────────────────────────── */}
				{searchTerm && !loading && sedes.length === 0 && (
					<div style={{
						display: "flex", flexDirection: "column", alignItems: "center",
						padding: "56px 32px", backgroundColor: "#fff",
						border: "2px dashed #e5e7eb", borderRadius: "14px", textAlign: "center",
					}}>
						<Search size={40} color="#d1d5db" style={{ marginBottom: "12px" }} />
						<h3 style={{ fontSize: "17px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
							Sin resultados para "{searchTerm}"
						</h3>
						<p style={{ fontSize: "15px", color: "#9ca3af" }}>Prueba con otro nombre de equipo.</p>
					</div>
				)}

				{/* ── Resultados ────────────────────────────────── */}
				{searchTerm && !loading && sedes.length > 0 && (
					<>
						{/* Propuesta de reordenamiento automática */}
						{bestOrigen && bestDestino && getUnidadNombre(bestOrigen) !== getUnidadNombre(bestDestino) && (
							<div style={{
								display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
								gap: "16px",
								padding: "20px 24px", borderRadius: "14px",
								backgroundColor: "#EFF6FF", border: "1px solid #dbeafe",
								boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
							}}>
								<div>
									<p style={{ fontSize: "13px", fontWeight: 700, color: "#002B5E", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
										💡 Propuesta de reordenamiento
									</p>
									<p style={{ fontSize: "15px", fontWeight: 500, color: "#374151", lineHeight: 1.5 }}>
										Trasladar{" "}
										<strong style={{ color: "#002B5E" }}>
											{Math.min(getExcedente(bestOrigen), getDeficit(bestDestino))} unidad(es)
										</strong>
										{" desde "}<strong>{getUnidadNombre(bestOrigen)}</strong>
										{" hacia "}<strong>{getUnidadNombre(bestDestino)}</strong>
									</p>
								</div>
								<button
									onClick={() => navigate("/reordenamientos/nuevo")}
									style={{
										display: "inline-flex", alignItems: "center", gap: "8px",
										height: "44px", padding: "0 20px", borderRadius: "10px",
										backgroundColor: "#002B5E", color: "#fff",
										fontSize: "14px", fontWeight: 700, border: "none",
										cursor: "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)",
										flexShrink: 0,
									}}
								>
									<ArrowRightLeft size={16} />
									Crear reordenamiento
								</button>
							</div>
						)}

						{/* Leyenda */}
						<div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
							<span style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
								{sedes.length} unidad{sedes.length === 1 ? "" : "es"} académica{sedes.length === 1 ? "" : "s"} · "{searchTerm}"
							</span>
							<div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
								{[
									{ color: "#16a34a", label: "Suficiente (≥ 100%)" },
									{ color: "#f59e0b", label: "Ajustado (60–99%)" },
									{ color: "#dc2626", label: "Insuficiente (< 60%)" },
								].map(({ color, label }) => (
									<span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 600, color: "#6b7280" }}>
										<span style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: color, flexShrink: 0 }} />
										{label}
									</span>
								))}
							</div>
						</div>

						{/* Grid de tarjetas */}
						<div style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
							gap: "20px",
						}}>
							{sedes.map((sede, i) => (
								<SedeCard
									key={getSede(sede) + i}
									sede={sede}
									maxDisp={maxDisp}
									maxReq={maxReq}
								/>
							))}
						</div>

						{/* Tabla resumen */}
						<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
							<div style={{ padding: "16px 24px", borderBottom: "1px solid #f3f4f6" }}>
								<h2 style={{ fontSize: "15px", fontWeight: 700, color: "#374151" }}>Tabla resumen</h2>
							</div>
							<div style={{ overflowX: "auto" }}>
								<table style={{ minWidth: "600px", borderCollapse: "collapse", width: "100%" }}>
									<thead>
										<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
											{["Unidad Académica", "Disponibles", "Requeridos", "Déficit", "Excedente", "Cobertura"].map((h) => (
												<th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em" }}>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{sedes.map((s, i) => {
											const ratio   = getRatio(s);
											const config  = getRatioConfig(ratio);
											const disp    = getDisp(s);
											const req     = getReq(s);
											const deficit = getDeficit(s);
											const exc     = getExcedente(s);
											return (
												<tr key={i} style={{ borderBottom: i < sedes.length - 1 ? "1px solid #f3f4f6" : "none" }} className="hover:bg-gray-50">
													<td style={{ padding: "13px 20px", fontSize: "15px", fontWeight: 700, color: "#111827" }}>{getUnidadNombre(s)}</td>
													<td style={{ padding: "13px 20px", fontSize: "15px", fontWeight: 600, color: config.bar }}>{disp}</td>
													<td style={{ padding: "13px 20px", fontSize: "15px", fontWeight: 600, color: "#374151" }}>{req}</td>
													<td style={{ padding: "13px 20px" }}>
														{deficit > 0
															? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "26px", padding: "0 10px", borderRadius: "6px", backgroundColor: "#fef2f2", color: "#b91c1c", fontSize: "13px", fontWeight: 700 }}>−{deficit}</span>
															: <span style={{ color: "#9ca3af", fontSize: "13px" }}>—</span>
														}
													</td>
													<td style={{ padding: "13px 20px" }}>
														{exc > 0
															? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "26px", padding: "0 10px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#15803d", fontSize: "13px", fontWeight: 700 }}>+{exc}</span>
															: <span style={{ color: "#9ca3af", fontSize: "13px" }}>—</span>
														}
													</td>
													<td style={{ padding: "13px 20px" }}>
														<span style={{ fontSize: "14px", fontWeight: 700, color: config.text }}>
															{req > 0 ? `${Math.round(ratio * 100)}%` : "N/A"}
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</div>
		</PageWrapper>
	);
}