// src/pages/reportes/ReportesPage.jsx
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	FileDown, FlaskConical, CalendarRange, BarChart2, Download,
	Building2, LoaderCircle, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
	BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
	XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { fetchLaboratorios, fetchEquipos } from "../../api/laboratoriosApi";
import axiosClient from "../../api/axiosClient";
import { BASE_URL, ROLES, API_ROUTES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { useAuth } from "../../store/AuthContext";
import { useDownloadPDF } from "../../hooks/useDownloadPDF";
import { Navigate } from "react-router-dom";
import GraficoSeccion, { COLORES_ESTADO } from "../../components/reportes/GraficoSeccion";
import { useExportSectionPDF } from "../../hooks/useExportSectionPDF";
import ReporteUnidadAcademica from "./ReporteUnidadAcademica";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const getId = (l) => l?.id ?? l?.uuid;
const getLabName = (l) => {
	const nombre = l?.nombre ?? l?.nombre_laboratorio ?? l?.descripcion ?? "Laboratorio";
	const unidadNombre = l?.sede_nombre ?? l?.unidad_academica_nombre ?? l?.sede ?? "";
	return unidadNombre ? `${nombre} — ${unidadNombre}` : nombre;
};

const PIE_COLORS = [COLORES_ESTADO.bueno, COLORES_ESTADO.regular, COLORES_ESTADO.malo];

/* ── Zod ─────────────────────────────────────────────────────── */
const fechasSchema = z.object({
	fecha_inicio: z.string().min(1, "La fecha de inicio es obligatoria"),
	fecha_fin: z.string().min(1, "La fecha de fin es obligatoria"),
}).refine(
	(d) => new Date(d.fecha_inicio) <= new Date(d.fecha_fin),
	{ message: "La fecha inicio debe ser anterior o igual a la fecha fin", path: ["fecha_fin"] }
);

/* ── Tabs config ─────────────────────────────────────────────── */
const TABS = [
	{ id: "inventario", label: "Inventario", icon: FlaskConical },
	{ id: "movimientos", label: "Movimientos", icon: CalendarRange },
	{ id: "comparativa", label: "Comparativa Unidades Académicas", icon: BarChart2 },
	{ id: "unidad_academica", label: "Por Unidad Académica", icon: Building2, isNew: true },
];

/* ── UI sub-components ───────────────────────────────────────── */
function ReportCard({ icon: Icon, title, description, children }) {
	return (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
			<div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
				<div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
					<Icon size={21} color="#002B5E" />
				</div>
				<div>
					<h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{title}</h2>
					{description && <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, marginTop: 3 }}>{description}</p>}
				</div>
			</div>
			<div style={{ padding: 24 }}>{children}</div>
		</div>
	);
}

function DownloadBtn({ loading, disabled, onClick, label = "Generar PDF", type = "button" }) {
	return (
		<button type={type} onClick={onClick} disabled={loading || disabled}
			style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 46, padding: "0 24px", borderRadius: 10, backgroundColor: (loading || disabled) ? "#9ca3af" : "#002B5E", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: (loading || disabled) ? "not-allowed" : "pointer", boxShadow: (!loading && !disabled) ? "0 4px 6px rgba(0,43,94,0.25)" : "none", transition: "all 200ms ease", flexShrink: 0 }}>
			{loading ? <><LoaderCircle size={17} className="animate-spin" />Generando...</> : <><FileDown size={17} />{label}</>}
		</button>
	);
}

function FieldError({ message }) {
	if (!message) return null;
	return <p style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{message}</p>;
}

function ChartTooltip({ active, payload, label }) {
	if (!active || !payload?.length) return null;
	return (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 13 }}>
			<p style={{ fontWeight: 700, marginBottom: 4, color: "#111827" }}>{label}</p>
			{payload.map((p, i) => <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value}</strong></p>)}
		</div>
	);
}

/* ══ MAIN ════════════════════════════════════════════════════════ */
export default function ReportesPage() {
	const { hasRole } = useAuth();
	if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) return <Navigate to="/dashboard" replace />;

	const [activeTab, setActiveTab] = useState("inventario");

	/* ── Queries ──────────────────────────────────────────── */
	const { data: labsData, isLoading: loadingLabs } = useQuery({ queryKey: ["laboratorios"], queryFn: fetchLaboratorios, staleTime: 5 * 60 * 1000 });
	const laboratorios = normalize(labsData);

	const { data: equiposData, isLoading: loadingEquipos } = useQuery({ queryKey: ["todos-equipos"], queryFn: () => fetchEquipos({ page_size: 1000 }), staleTime: 5 * 60 * 1000 });
	const allEquipos = normalize(equiposData);

	const { data: reordData, isLoading: loadingReord } = useQuery({ queryKey: ["todos-reord"], queryFn: () => axiosClient.get(API_ROUTES.REORDENAMIENTO.BASE, { params: { page_size: 500 } }), staleTime: 5 * 60 * 1000 });
	const allReord = normalize(reordData);

	/* ── Chart data: Inventario ───────────────────────────── */
	const invDonut = useMemo(() => {
		const b = allEquipos.filter(e => e.estatus_general === "bueno").length;
		const r = allEquipos.filter(e => e.estatus_general === "regular").length;
		const m = allEquipos.filter(e => e.estatus_general === "malo").length;
		return [{ name: "Bueno", value: b }, { name: "Regular", value: r }, { name: "Malo", value: m }].filter(d => d.value > 0);
	}, [allEquipos]);

	const invTopTipos = useMemo(() => {
		const map = {};
		allEquipos.forEach(e => { const t = e.nombre?.split(" ")[0] || "Otro"; map[t] = (map[t] || 0) + (e.cantidad_total || 1); });
		return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
	}, [allEquipos]);

	/* ── Chart data: Movimientos ──────────────────────────── */
	const movMensual = useMemo(() => {
		const now = new Date();
		const meses = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			meses.push({ mes: d.toLocaleString("es", { month: "short" }), y: d.getFullYear(), m: d.getMonth(), traslados: 0 });
		}
		allReord.forEach(r => {
			const f = new Date(r.created_at || r.fecha_solicitud);
			const e = meses.find(m => m.y === f.getFullYear() && m.m === f.getMonth());
			if (e) e.traslados++;
		});
		return meses;
	}, [allReord]);

	const topRutas = useMemo(() => {
		const map = {};
		allReord.forEach(r => {
			const key = `${r.laboratorio_origen_nombre || "?"} → ${r.laboratorio_destino_nombre || "?"}`;
			map[key] = (map[key] || 0) + 1;
		});
		return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
	}, [allReord]);

	/* ── PDF hooks ────────────────────────────────────────── */
	const { downloadPDF: downloadInventario, isDownloading: loadingInventario } = useDownloadPDF();
	const { downloadPDF: downloadReordenamientos, isDownloading: loadingReordenam } = useDownloadPDF();
	const { downloadPDF: downloadComparativa, isDownloading: loadingComparativa } = useDownloadPDF();

	/* ── State ────────────────────────────────────────────── */
	const [labId, setLabId] = useState("");
	const [nombreEquipo, setNombreEquipo] = useState("");
	const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(fechasSchema), defaultValues: { fecha_inicio: "", fecha_fin: "" } });

	/* ── Handlers ─────────────────────────────────────────── */
	const handleInventario = () => {
		if (!labId) { toast.error("Selecciona un laboratorio primero"); return; }
		downloadInventario(`${BASE_URL}/api/v1/reportes/inventario-laboratorio/${labId}/`, `inventario-laboratorio-${labId}.pdf`);
	};
	const handleReordenamientos = handleSubmit((v) => {
		downloadReordenamientos(`${BASE_URL}/api/v1/reportes/reordenamientos/`, `reordenamientos-${v.fecha_inicio}-${v.fecha_fin}.pdf`, { fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin });
	});
	const handleComparativa = () => {
		if (!nombreEquipo.trim()) { toast.error("Ingresa el nombre del equipo a comparar"); return; }
		downloadComparativa(`${BASE_URL}/api/v1/reportes/comparativa-sedes/?nombre_equipo=${encodeURIComponent(nombreEquipo.trim())}`, "comparativa-unidades-academicas.pdf");
	};

	const chartsLoading = loadingEquipos || loadingReord;

	/* ── Section PDF export hooks ────────────────────────── */
	const { exportRef: invRef, exportPDF: exportInvPDF, isExporting: isExportingInv } = useExportSectionPDF();
	const { exportRef: movRef, exportPDF: exportMovPDF, isExporting: isExportingMov } = useExportSectionPDF();

	/* ── Render ───────────────────────────────────────────── */
	return (
		<PageWrapper title="Reportes" description="Genera reportes institucionales y analiza datos con gráficos interactivos.">

			{/* ── Tab bar ─────────────────────────────────────── */}
			<div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", borderBottom: "2px solid #e5e7eb", paddingBottom: 0 }}>
				{TABS.map(t => {
					const active = activeTab === t.id;
					return (
						<button key={t.id} onClick={() => setActiveTab(t.id)}
							style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", border: "none", borderBottom: active ? "3px solid #002B5E" : "3px solid transparent", backgroundColor: "transparent", color: active ? "#002B5E" : "#6b7280", fontSize: 14, fontWeight: active ? 800 : 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 150ms ease", marginBottom: -2, position: "relative" }}>
							<t.icon size={17} />
							{t.label}
							{t.isNew && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10, backgroundColor: "#dbeafe", color: "#1d4ed8", lineHeight: 1.4 }}>Nuevo</span>}
						</button>
					);
				})}
			</div>

			{/* ══ TAB: Inventario ═══════════════════════════════ */}
			{activeTab === "inventario" && (
				<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
					{/* Export button */}
					<div style={{ display: "flex", justifyContent: "flex-end" }}>
						<button onClick={() => exportInvPDF(`reporte-inventario-${Date.now()}.pdf`, "Reporte de Inventario General")} disabled={isExportingInv || chartsLoading}
							style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, backgroundColor: (isExportingInv || chartsLoading) ? "#9ca3af" : "#002B5E", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: (isExportingInv || chartsLoading) ? "not-allowed" : "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)" }}>
							{isExportingInv ? <><LoaderCircle size={16} className="animate-spin" />Generando...</> : <><FileDown size={16} />Exportar PDF con Gráficos</>}
						</button>
					</div>
					{/* Exportable section */}
					<div ref={invRef} style={{ display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#fff", padding: 4 }}>
					{/* Charts */}
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
						<GraficoSeccion titulo="Distribución por Estado" subtitulo="Todos los equipos" isLoading={chartsLoading}>
							{invDonut.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie data={invDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
											{invDonut.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
										</Pie>
										<Tooltip />
										<Legend wrapperStyle={{ fontSize: 12 }} />
									</PieChart>
								</ResponsiveContainer>
							) : (
								<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, fontWeight: 500 }}>Sin datos para mostrar</div>
							)}
						</GraficoSeccion>

						<GraficoSeccion titulo="Top 5 Tipos de Equipo" subtitulo="Por cantidad total" isLoading={chartsLoading}>
							{invTopTipos.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={invTopTipos} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="name" tick={{ fontSize: 11 }} />
										<YAxis tick={{ fontSize: 12 }} />
										<Tooltip content={<ChartTooltip />} />
										<Bar dataKey="value" fill="#002B5E" radius={[6, 6, 0, 0]} name="Cantidad" />
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, fontWeight: 500 }}>Sin datos para mostrar</div>
							)}
						</GraficoSeccion>
					</div>

					{/* PDF download card */}
					<ReportCard icon={FlaskConical} title="Inventario por Laboratorio" description="Estado actual de todos los equipos en el laboratorio seleccionado.">
						<div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
							<div style={{ flex: 1, minWidth: 220 }}>
								<label htmlFor="lab-select" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Laboratorio</label>
								{loadingLabs ? (
									<div style={{ height: 48, borderRadius: 8, backgroundColor: "#f3f4f6" }} className="animate-pulse" />
								) : (
									<select id="lab-select" value={labId} onChange={(e) => setLabId(e.target.value)} style={{ width: "100%", height: 48, borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", paddingLeft: 14, paddingRight: 40, fontSize: 15, fontWeight: 500, color: labId ? "#111827" : "#9ca3af", outline: "none", appearance: "none", cursor: "pointer" }}>
										<option value="">Selecciona un laboratorio…</option>
										{laboratorios.map((l) => <option key={getId(l)} value={getId(l)}>{getLabName(l)}</option>)}
									</select>
								)}
							</div>
							<DownloadBtn loading={loadingInventario} disabled={!labId} onClick={handleInventario} />
						</div>
					</ReportCard>
					</div>{/* end exportable */}
				</div>
			)}

			{/* ══ TAB: Movimientos ══════════════════════════════ */}
			{activeTab === "movimientos" && (
				<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
					{/* Export button */}
					<div style={{ display: "flex", justifyContent: "flex-end" }}>
						<button onClick={() => exportMovPDF(`reporte-movimientos-${Date.now()}.pdf`, "Reporte de Movimientos y Traslados")} disabled={isExportingMov || chartsLoading}
							style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 20px", borderRadius: 10, backgroundColor: (isExportingMov || chartsLoading) ? "#9ca3af" : "#002B5E", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: (isExportingMov || chartsLoading) ? "not-allowed" : "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)" }}>
							{isExportingMov ? <><LoaderCircle size={16} className="animate-spin" />Generando...</> : <><FileDown size={16} />Exportar PDF con Gráficos</>}
						</button>
					</div>
					{/* Exportable section */}
					<div ref={movRef} style={{ display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#fff", padding: 4 }}>
					{/* Charts */}
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
						<GraficoSeccion titulo="Traslados por Mes" subtitulo="Últimos 6 meses" isLoading={chartsLoading}>
							{movMensual.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={movMensual} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis dataKey="mes" tick={{ fontSize: 12 }} />
										<YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
										<Tooltip content={<ChartTooltip />} />
										<Line type="monotone" dataKey="traslados" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: "#8b5cf6" }} name="Traslados" />
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, fontWeight: 500 }}>Sin datos para mostrar</div>
							)}
						</GraficoSeccion>

						<GraficoSeccion titulo="Top 5 Rutas Frecuentes" subtitulo="Origen → Destino" isLoading={chartsLoading}>
							{topRutas.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={topRutas} layout="vertical" margin={{ left: 30, right: 20, top: 5, bottom: 5 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
										<XAxis type="number" tick={{ fontSize: 12 }} />
										<YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
										<Tooltip content={<ChartTooltip />} />
										<Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Traslados" />
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, fontWeight: 500 }}>Sin datos para mostrar</div>
							)}
						</GraficoSeccion>
					</div>

					{/* PDF download card */}
					<ReportCard icon={CalendarRange} title="Reordenamientos por Rango de Fechas" description="Historial de traslados de equipos ejecutados en el período seleccionado.">
						<form onSubmit={handleReordenamientos} noValidate>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "flex-end" }}>
								<div>
									<label htmlFor="fecha-inicio" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Fecha inicio <span style={{ color: "#ef4444" }}>*</span></label>
									<input id="fecha-inicio" type="date" style={{ width: "100%", height: 48, borderRadius: 8, border: `1px solid ${errors.fecha_inicio ? "#f87171" : "#d1d5db"}`, backgroundColor: "#fff", padding: "0 14px", fontSize: 15, fontWeight: 500, color: "#111827", outline: "none" }} {...register("fecha_inicio")} />
									<FieldError message={errors.fecha_inicio?.message} />
								</div>
								<div>
									<label htmlFor="fecha-fin" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Fecha fin <span style={{ color: "#ef4444" }}>*</span></label>
									<input id="fecha-fin" type="date" style={{ width: "100%", height: 48, borderRadius: 8, border: `1px solid ${errors.fecha_fin ? "#f87171" : "#d1d5db"}`, backgroundColor: "#fff", padding: "0 14px", fontSize: 15, fontWeight: 500, color: "#111827", outline: "none" }} {...register("fecha_fin")} />
									<FieldError message={errors.fecha_fin?.message} />
								</div>
								<DownloadBtn type="submit" loading={loadingReordenam} />
							</div>
						</form>
					</ReportCard>
					</div>{/* end exportable */}
				</div>
			)}

			{/* ══ TAB: Comparativa ══════════════════════════════ */}
			{activeTab === "comparativa" && (
				<ReportCard icon={BarChart2} title="Comparativa General de Unidades Académicas" description="Resumen ejecutivo con disponibilidades y déficits de equipos por unidad académica.">
					<div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between" }}>
						<div style={{ flex: 1, minWidth: 260, maxWidth: 480 }}>
							<label htmlFor="equipo-input" style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Nombre del Equipo a comparar <span style={{ color: "#ef4444" }}>*</span></label>
							<input id="equipo-input" type="text" placeholder="Ej: Balanza Digital" value={nombreEquipo} onChange={(e) => setNombreEquipo(e.target.value)} style={{ width: "100%", height: 48, borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", paddingLeft: 14, paddingRight: 14, fontSize: 15, fontWeight: 500, color: "#111827", outline: "none" }} />
						</div>
						<DownloadBtn loading={loadingComparativa} disabled={!nombreEquipo.trim()} onClick={handleComparativa} label="Exportar PDF" />
					</div>
				</ReportCard>
			)}

			{/* ══ TAB: Por Unidad Académica ═════════════════════ */}
			{activeTab === "unidad_academica" && <ReporteUnidadAcademica />}

		</PageWrapper>
	);
}
