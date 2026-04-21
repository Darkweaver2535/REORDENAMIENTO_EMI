// src/pages/reportes/ReportesPage.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	FileDown, FlaskConical, CalendarRange, BarChart2, Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { fetchLaboratorios } from "../../api/laboratoriosApi";
import { BASE_URL, ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { useAuth } from "../../store/AuthContext";
import { useDownloadPDF } from "../../hooks/useDownloadPDF";
import { Navigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize  = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const getId      = (l) => l?.id ?? l?.uuid;
const getLabName = (l) => {
	const nombre = l?.nombre ?? l?.nombre_laboratorio ?? l?.descripcion ?? "Laboratorio";
	const sede   = l?.sede_nombre ?? l?.unidad_academica_nombre ?? l?.sede ?? "";
	return sede ? `${nombre} — ${sede}` : nombre;
};

/* ── Esquema Zod para rango de fechas ────────────────────────── */
const fechasSchema = z.object({
	fecha_inicio: z.string().min(1, "La fecha de inicio es obligatoria"),
	fecha_fin:    z.string().min(1, "La fecha de fin es obligatoria"),
}).refine(
	(d) => new Date(d.fecha_inicio) <= new Date(d.fecha_fin),
	{ message: "La fecha inicio debe ser anterior o igual a la fecha fin", path: ["fecha_fin"] }
);

/* ── Sub-componentes UI ──────────────────────────────────────── */
function ReportCard({ icon: Icon, title, description, children }) {
	return (
		<div style={{
			backgroundColor: "#fff", border: "1px solid #e5e7eb",
			borderRadius: "16px", overflow: "hidden",
			boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
		}}>
			<div style={{
				display: "flex", alignItems: "center", gap: "14px",
				padding: "20px 24px", borderBottom: "1px solid #f3f4f6",
				backgroundColor: "#fafafa",
			}}>
				<div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
					<Icon size={21} color="#002B5E" />
				</div>
				<div>
					<h2 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{title}</h2>
					{description && <p style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500, marginTop: "3px" }}>{description}</p>}
				</div>
			</div>
			<div style={{ padding: "24px" }}>{children}</div>
		</div>
	);
}

function DownloadBtn({ loading, disabled, onClick, label = "Generar PDF", type = "button" }) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={loading || disabled}
			style={{
				display: "inline-flex", alignItems: "center", gap: "8px",
				height: "46px", padding: "0 24px", borderRadius: "10px",
				backgroundColor: (loading || disabled) ? "#9ca3af" : "#002B5E",
				color: "#fff", fontSize: "15px", fontWeight: 700, border: "none",
				cursor: (loading || disabled) ? "not-allowed" : "pointer",
				boxShadow: (!loading && !disabled) ? "0 4px 6px rgba(0,43,94,0.25)" : "none",
				transition: "all 200ms ease", flexShrink: 0,
			}}
		>
			{loading
				? <><LoaderCircle size={17} className="animate-spin" />Generando...</>
				: <><FileDown size={17} />{label}</>
			}
		</button>
	);
}

function FieldError({ message }) {
	if (!message) return null;
	return <p style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>{message}</p>;
}

/* ══ Componente principal ════════════════════════════════════════ */
export default function ReportesPage() {
	const { hasRole } = useAuth();

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.DECANO)) {
		return <Navigate to="/dashboard" replace />;
	}

	/* ── React Query: laboratorios ────────────────────────────── */
	const { data: labsData, isLoading: loadingLabs } = useQuery({
		queryKey: ["laboratorios"],
		queryFn: fetchLaboratorios,
		staleTime: 5 * 60 * 1000,
	});
	const laboratorios = normalize(labsData);

	/* ── Hook (una instancia por sección para spinners individuales) */
	const { downloadPDF: downloadInventario,   isDownloading: loadingInventario }   = useDownloadPDF();
	const { downloadPDF: downloadReordenamientos, isDownloading: loadingReordenam } = useDownloadPDF();
	const { downloadPDF: downloadComparativa,  isDownloading: loadingComparativa }  = useDownloadPDF();

	/* ── Estado local ─────────────────────────────────────────── */
	const [labId, setLabId] = useState("");
	const [nombreEquipo, setNombreEquipo] = useState("");

	/* ── Form fechas ──────────────────────────────────────────── */
	const { register, handleSubmit, formState: { errors } } = useForm({
		resolver: zodResolver(fechasSchema),
		defaultValues: { fecha_inicio: "", fecha_fin: "" },
	});

	/* ── Handlers ─────────────────────────────────────────────── */
	const handleInventario = () => {
		if (!labId) { toast.error("Selecciona un laboratorio primero"); return; }
		downloadInventario(
			`${BASE_URL}/api/v1/reportes/inventario-laboratorio/${labId}/`,
			`inventario-laboratorio-${labId}.pdf`
		);
	};

	const handleReordenamientos = handleSubmit((values) => {
		downloadReordenamientos(
			`${BASE_URL}/api/v1/reportes/reordenamientos/`,
			`reordenamientos-${values.fecha_inicio}-${values.fecha_fin}.pdf`,
			{ fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin }
		);
	});

	const handleComparativa = () => {
		if (!nombreEquipo.trim()) {
			toast.error("Ingresa el nombre del equipo a comparar");
			return;
		}
		downloadComparativa(
			`${BASE_URL}/api/v1/reportes/comparativa-sedes/?nombre_equipo=${encodeURIComponent(nombreEquipo.trim())}`,
			"comparativa-sedes.pdf"
		);
	};

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Reportes"
			description="Genera y descarga reportes institucionales en formato PDF."
		>
			{/* Banner informativo */}
			<div style={{
				display: "flex", alignItems: "flex-start", gap: "12px",
				padding: "16px 20px", borderRadius: "12px",
				backgroundColor: "#EFF6FF", border: "1px solid #dbeafe",
				marginBottom: "28px",
			}}>
				<Download size={18} color="#002B5E" style={{ flexShrink: 0, marginTop: "2px" }} />
				<p style={{ fontSize: "14px", fontWeight: 500, color: "#374151", lineHeight: 1.6 }}>
					Los reportes se generan en el servidor y se descargan automáticamente en PDF.
					El token de sesión se envía automáticamente con cada solicitud.
				</p>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

				{/* ══ 1 — Inventario por laboratorio ══════════════ */}
				<ReportCard
					icon={FlaskConical}
					title="Inventario por Laboratorio"
					description="Estado actual de todos los equipos en el laboratorio seleccionado."
				>
					<div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
						<div style={{ flex: 1, minWidth: "220px" }}>
							<label htmlFor="lab-select" style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
								Laboratorio
							</label>
							{loadingLabs ? (
								<div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
							) : (
								<div style={{ position: "relative" }}>
									<select
										id="lab-select"
										value={labId}
										onChange={(e) => setLabId(e.target.value)}
										style={{
											width: "100%", height: "48px", borderRadius: "8px",
											border: "1px solid #d1d5db", backgroundColor: "#fff",
											paddingLeft: "14px", paddingRight: "40px",
											fontSize: "15px", fontWeight: 500,
											color: labId ? "#111827" : "#9ca3af",
											outline: "none", appearance: "none", cursor: "pointer",
										}}
									>
										<option value="">Selecciona un laboratorio…</option>
										{laboratorios.map((l) => (
											<option key={getId(l)} value={getId(l)}>{getLabName(l)}</option>
										))}
									</select>
									<FlaskConical size={16} color="#9ca3af"
										style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
									/>
								</div>
							)}
							{!labId && (
								<p style={{ marginTop: "6px", fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
									Selecciona un laboratorio para activar la descarga.
								</p>
							)}
						</div>

						<DownloadBtn
							loading={loadingInventario}
							disabled={!labId}
							onClick={handleInventario}
						/>
					</div>
				</ReportCard>

				{/* ══ 2 — Reordenamientos por fechas ══════════════ */}
				<ReportCard
					icon={CalendarRange}
					title="Reordenamientos por Rango de Fechas"
					description="Historial de traslados de equipos ejecutados en el período seleccionado."
				>
					<form onSubmit={handleReordenamientos} noValidate>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "flex-end" }}
							className="max-sm:grid-cols-1"
						>
							<div>
								<label htmlFor="fecha-inicio" style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
									Fecha inicio <span style={{ color: "#ef4444" }}>*</span>
								</label>
								<input
									id="fecha-inicio"
									type="date"
									style={{
										width: "100%", height: "48px", borderRadius: "8px",
										border: `1px solid ${errors.fecha_inicio ? "#f87171" : "#d1d5db"}`,
										backgroundColor: "#fff", padding: "0 14px",
										fontSize: "15px", fontWeight: 500, color: "#111827", outline: "none",
									}}
									{...register("fecha_inicio")}
								/>
								<FieldError message={errors.fecha_inicio?.message} />
							</div>

							<div>
								<label htmlFor="fecha-fin" style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
									Fecha fin <span style={{ color: "#ef4444" }}>*</span>
								</label>
								<input
									id="fecha-fin"
									type="date"
									style={{
										width: "100%", height: "48px", borderRadius: "8px",
										border: `1px solid ${errors.fecha_fin ? "#f87171" : "#d1d5db"}`,
										backgroundColor: "#fff", padding: "0 14px",
										fontSize: "15px", fontWeight: 500, color: "#111827", outline: "none",
									}}
									{...register("fecha_fin")}
								/>
								<FieldError message={errors.fecha_fin?.message} />
							</div>

							<DownloadBtn type="submit" loading={loadingReordenam} />
						</div>
					</form>
				</ReportCard>

				{/* ══ 3 — Comparativa general de sedes ════════════ */}
				<ReportCard
					icon={BarChart2}
					title="Comparativa General de Sedes"
					description="Resumen ejecutivo con disponibilidades y déficits de equipos por sede."
				>
					<div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between" }}>
						<div style={{ flex: 1, minWidth: "260px", maxWidth: "480px" }}>
							<label htmlFor="equipo-input" style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
								Nombre del Equipo a comparar <span style={{ color: "#ef4444" }}>*</span>
							</label>
							<input
								id="equipo-input"
								type="text"
								placeholder="Ej: Balanza Digital"
								value={nombreEquipo}
								onChange={(e) => setNombreEquipo(e.target.value)}
								style={{
									width: "100%", height: "48px", borderRadius: "8px",
									border: "1px solid #d1d5db", backgroundColor: "#fff",
									paddingLeft: "14px", paddingRight: "14px",
									fontSize: "15px", fontWeight: 500, color: "#111827", outline: "none",
								}}
							/>
						</div>
						<DownloadBtn
							loading={loadingComparativa}
							disabled={!nombreEquipo.trim()}
							onClick={handleComparativa}
							label="Exportar PDF"
						/>
					</div>
				</ReportCard>

			</div>
		</PageWrapper>
	);
}
