import { useState, useEffect, useMemo } from "react";
import { Package, CheckCircle, Monitor, ArrowLeftRight, AlertTriangle, Info, RefreshCw, ChevronUp, ChevronDown, FileDown, LoaderCircle } from "lucide-react";
import {
	BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
	XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchLaboratorios, fetchEquipos } from "../../api/laboratoriosApi";
import axiosClient from "../../api/axiosClient";
import { API_ROUTES } from "../../constants/api";
import GraficoSeccion, { COLORES_ESTADO } from "../../components/reportes/GraficoSeccion";
import { useExportSectionPDF } from "../../hooks/useExportSectionPDF";

const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const pct = (n, t) => t > 0 ? Math.round((n / t) * 100) : 0;

const ESTADOS_PILLS = [
	{ id: "todos", label: "Todos", color: "#6b7280" },
	{ id: "bueno", label: "Bueno", color: COLORES_ESTADO.bueno },
	{ id: "regular", label: "Regular", color: COLORES_ESTADO.regular },
	{ id: "malo", label: "Malo", color: COLORES_ESTADO.malo },
];

/* ── KPI Card ──────────────────────────────────────────── */
function KPI({ label, value, pctVal, icon: Icon, color }) {
	return (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
			<div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
				<Icon size={22} color={color} />
			</div>
			<div>
				<p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{label}</p>
				<p style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "2px 0 0" }}>{value}</p>
				{pctVal !== undefined && <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{pctVal}% del total</p>}
			</div>
		</div>
	);
}

/* ── Custom Tooltip ─────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
	if (!active || !payload?.length) return null;
	return (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 13 }}>
			<p style={{ fontWeight: 700, marginBottom: 4, color: "#111827" }}>{label}</p>
			{payload.map((p, i) => (
				<p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value}</strong></p>
			))}
		</div>
	);
}

/* ══ MAIN ════════════════════════════════════════════════ */
export default function ReporteUnidadAcademica() {
	const { exportRef, exportPDF, isExporting } = useExportSectionPDF();
	const [unidadSel, setUnidadSel] = useState("todas");
	const [unidades, setUnidades] = useState([]);
	const [equipos, setEquipos] = useState([]);
	const [reordenamientos, setReordenamientos] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filtroEstado, setFiltroEstado] = useState("todos");
	const [pagina, setPagina] = useState(1);
	const [sortCol, setSortCol] = useState("codigo_activo");
	const [sortDir, setSortDir] = useState("asc");
	const PER_PAGE = 10;

	const uaNombre = unidadSel === "todas" ? "Todas las UA" : (unidades.find(u => String(u.id) === String(unidadSel))?.nombre || "UA");

	/* ── Carga inicial ────────────────────────────────────── */
	useEffect(() => {
		(async () => {
			setIsLoading(true);
			try {
				const [uaRes, eqRes, reordRes] = await Promise.all([
					axiosClient.get(API_ROUTES.ESTRUCTURA.UNIDADES),
					fetchEquipos({ page_size: 1000 }),
					axiosClient.get(API_ROUTES.REORDENAMIENTO.BASE, { params: { page_size: 500 } }),
				]);
				setUnidades(normalize(uaRes));
				setEquipos(normalize(eqRes));
				setReordenamientos(normalize(reordRes));
			} catch (e) { console.error("Error cargando datos reporte UA:", e); }
			setIsLoading(false);
		})();
	}, []);

	/* ── Equipos filtrados por UA ─────────────────────────── */
	const equiposFiltrados = useMemo(() => {
		if (unidadSel === "todas") return equipos;
		return equipos.filter((e) => {
			const uaId = e?.laboratorio_unidad_academica_id ?? e?.unidad_academica_id;
			return String(uaId) === String(unidadSel);
		});
	}, [equipos, unidadSel]);

	/* ── KPIs ─────────────────────────────────────────────── */
	const kpis = useMemo(() => {
		const total = equiposFiltrados.length;
		const buenos = equiposFiltrados.filter(e => e.estatus_general === "bueno").length;
		const regulares = equiposFiltrados.filter(e => e.estatus_general === "regular").length;
		const malos = equiposFiltrados.filter(e => e.estatus_general === "malo").length;
		const reordCount = reordenamientos.filter(r => {
			if (unidadSel === "todas") return true;
			return String(r.laboratorio_origen_unidad_id) === String(unidadSel) || String(r.laboratorio_destino_unidad_id) === String(unidadSel);
		}).length;
		return { total, buenos, regulares, malos, reordCount };
	}, [equiposFiltrados, reordenamientos, unidadSel]);

	/* ── Datos gráfico barras por UA ─────────────────────── */
	const barrasUA = useMemo(() => {
		const map = {};
		unidades.forEach(u => { map[u.id] = { name: u.abreviacion || u.codigo || u.nombre, bueno: 0, regular: 0, malo: 0 }; });
		equipos.forEach(e => {
			const uaId = e?.laboratorio_unidad_academica_id ?? e?.unidad_academica_id;
			if (map[uaId]) map[uaId][e.estatus_general || "bueno"]++;
		});
		return Object.values(map);
	}, [equipos, unidades]);

	/* ── Datos donut estados ─────────────────────────────── */
	const donutData = useMemo(() => [
		{ name: "Bueno", value: kpis.buenos, color: COLORES_ESTADO.bueno },
		{ name: "Regular", value: kpis.regulares, color: COLORES_ESTADO.regular },
		{ name: "Malo", value: kpis.malos, color: COLORES_ESTADO.malo },
	].filter(d => d.value > 0), [kpis]);

	/* ── Datos barras por tipo de equipo ──────────────────── */
	const barrasTipo = useMemo(() => {
		const map = {};
		equiposFiltrados.forEach(e => {
			const tipo = e.nombre?.split(" ")[0] || "Otro";
			map[tipo] = (map[tipo] || 0) + (e.cantidad_total || 1);
		});
		return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
	}, [equiposFiltrados]);

	/* ── Datos línea temporal reordenamientos ─────────────── */
	const lineaReord = useMemo(() => {
		const now = new Date();
		const meses = [];
		for (let i = 5; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			meses.push({ mes: d.toLocaleString("es", { month: "short" }), y: d.getFullYear(), m: d.getMonth(), enviados: 0, recibidos: 0 });
		}
		reordenamientos.forEach(r => {
			const fecha = new Date(r.created_at || r.fecha_solicitud);
			const entry = meses.find(m => m.y === fecha.getFullYear() && m.m === fecha.getMonth());
			if (!entry) return;
			if (unidadSel !== "todas") {
				if (String(r.laboratorio_origen_unidad_id) === String(unidadSel)) entry.enviados++;
				if (String(r.laboratorio_destino_unidad_id) === String(unidadSel)) entry.recibidos++;
			} else { entry.enviados++; }
		});
		return meses;
	}, [reordenamientos, unidadSel]);

	/* ── Alertas inteligentes ─────────────────────────────── */
	const alertas = useMemo(() => {
		const list = [];
		const analizar = (ua, eqs) => {
			const total = eqs.length;
			if (total === 0) return;
			const buenos = eqs.filter(e => e.estatus_general === "bueno").length;
			const pBuenos = pct(buenos, total);
			const nombre = ua.nombre || ua.abreviacion;
			if (pBuenos < 15) list.push({ tipo: "deficit", icon: AlertTriangle, color: "#ef4444", msg: `${nombre} tiene solo ${buenos} equipos buenos de ${total} (${pBuenos}%)` });
			else if (pBuenos > 60) list.push({ tipo: "optimo", icon: CheckCircle, color: "#22c55e", msg: `${nombre} mantiene ${pBuenos}% de equipos en buen estado` });
			const reordUA = reordenamientos.filter(r => String(r.laboratorio_destino_unidad_id) === String(ua.id)).length;
			if (reordUA > 3) list.push({ tipo: "movilidad", icon: RefreshCw, color: "#8b5cf6", msg: `Se realizaron ${reordUA} reordenamientos hacia ${nombre}` });
		};
		if (unidadSel === "todas") {
			unidades.forEach(ua => {
				const eqs = equipos.filter(e => String(e?.laboratorio_unidad_academica_id ?? e?.unidad_academica_id) === String(ua.id));
				analizar(ua, eqs);
			});
		} else {
			const ua = unidades.find(u => String(u.id) === String(unidadSel));
			if (ua) analizar(ua, equiposFiltrados);
		}
		return list;
	}, [equipos, equiposFiltrados, unidades, unidadSel, reordenamientos]);

	/* ── Tabla: filtrado, orden, paginación ───────────────── */
	const tablaData = useMemo(() => {
		let data = filtroEstado === "todos" ? equiposFiltrados : equiposFiltrados.filter(e => e.estatus_general === filtroEstado);
		data = [...data].sort((a, b) => {
			const va = (a[sortCol] || "").toString().toLowerCase();
			const vb = (b[sortCol] || "").toString().toLowerCase();
			return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
		});
		return data;
	}, [equiposFiltrados, filtroEstado, sortCol, sortDir]);

	const totalPages = Math.ceil(tablaData.length / PER_PAGE) || 1;
	const paginatedData = tablaData.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);

	const toggleSort = (col) => {
		if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
		else { setSortCol(col); setSortDir("asc"); }
	};

	const SortIcon = ({ col }) => {
		if (sortCol !== col) return null;
		return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
	};

	const estadoBadge = (estado) => {
		const c = COLORES_ESTADO[estado] || "#6b7280";
		return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, backgroundColor: c + "18", color: c, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{estado}</span>;
	};

	/* ── Render ───────────────────────────────────────────── */
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

			{/* Export PDF button */}
			<div style={{ display: "flex", justifyContent: "flex-end" }}>
				<button onClick={() => exportPDF(`reporte-unidad-academica-${Date.now()}.pdf`, `Reporte por Unidad Académica — ${uaNombre}`)} disabled={isExporting || isLoading}
					style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 46, padding: "0 24px", borderRadius: 10, backgroundColor: (isExporting || isLoading) ? "#9ca3af" : "#002B5E", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: (isExporting || isLoading) ? "not-allowed" : "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)", transition: "all 200ms ease" }}>
					{isExporting ? <><LoaderCircle size={17} className="animate-spin" />Generando PDF...</> : <><FileDown size={17} />Exportar PDF con Gráficos</>}
				</button>
			</div>

			{/* Exportable section */}
			<div ref={exportRef} style={{ display: "flex", flexDirection: "column", gap: 24, backgroundColor: "#fff", padding: 4 }}>

			{/* Selector */}
			<div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
				<div style={{ flex: 1, minWidth: 220 }}>
					<label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Unidad Académica</label>
					<select value={unidadSel} onChange={e => { setUnidadSel(e.target.value); setPagina(1); }} style={{ width: "100%", height: 48, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 15, fontWeight: 500, color: "#111827", backgroundColor: "#fff", outline: "none" }}>
						<option value="todas">Todas las Unidades Académicas</option>
						{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
					</select>
				</div>
			</div>

			{/* KPIs */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
				<KPI label="Total Equipos" value={kpis.total} icon={Package} color="#002B5E" />
				<KPI label="Buenos" value={kpis.buenos} pctVal={pct(kpis.buenos, kpis.total)} icon={CheckCircle} color={COLORES_ESTADO.bueno} />
				<KPI label="Regular" value={kpis.regulares} pctVal={pct(kpis.regulares, kpis.total)} icon={Monitor} color={COLORES_ESTADO.regular} />
				<KPI label="Reordenamientos" value={kpis.reordCount} icon={ArrowLeftRight} color="#8b5cf6" />
			</div>

			{/* Gráficos */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>

				{unidadSel === "todas" && (
					<GraficoSeccion titulo="Equipos por Unidad Académica" subtitulo="Barras apiladas por estado" isLoading={isLoading}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={barrasUA} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
								<XAxis type="number" tick={{ fontSize: 12 }} />
								<YAxis dataKey="name" type="category" width={55} tick={{ fontSize: 12, fontWeight: 600 }} />
								<Tooltip content={<ChartTooltip />} />
								<Legend wrapperStyle={{ fontSize: 12 }} />
								<Bar dataKey="bueno" stackId="a" fill={COLORES_ESTADO.bueno} name="Bueno" radius={[0, 0, 0, 0]} />
								<Bar dataKey="regular" stackId="a" fill={COLORES_ESTADO.regular} name="Regular" />
								<Bar dataKey="malo" stackId="a" fill={COLORES_ESTADO.malo} name="Malo" radius={[0, 4, 4, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</GraficoSeccion>
				)}

				<GraficoSeccion titulo="Distribución de Estados" subtitulo={unidadSel === "todas" ? "General" : unidades.find(u => String(u.id) === String(unidadSel))?.nombre} isLoading={isLoading}>
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }}>
								{donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
							</Pie>
							<Tooltip formatter={(v, n) => [`${v} equipos`, n]} />
							<Legend wrapperStyle={{ fontSize: 12 }} />
						</PieChart>
					</ResponsiveContainer>
				</GraficoSeccion>

				{unidadSel !== "todas" && (
					<GraficoSeccion titulo="Equipos por Tipo" subtitulo="Top 8 tipos más comunes" isLoading={isLoading}>
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={barrasTipo} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
								<XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip content={<ChartTooltip />} />
								<Bar dataKey="value" fill="#002B5E" radius={[6, 6, 0, 0]} name="Cantidad" />
							</BarChart>
						</ResponsiveContainer>
					</GraficoSeccion>
				)}

				{unidadSel !== "todas" && (
					<GraficoSeccion titulo="Reordenamientos en el Tiempo" subtitulo="Últimos 6 meses" isLoading={isLoading}>
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={lineaReord} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
								<XAxis dataKey="mes" tick={{ fontSize: 12 }} />
								<YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
								<Tooltip content={<ChartTooltip />} />
								<Legend wrapperStyle={{ fontSize: 12 }} />
								<Line type="monotone" dataKey="enviados" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Enviados" />
								<Line type="monotone" dataKey="recibidos" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Recibidos" />
							</LineChart>
						</ResponsiveContainer>
					</GraficoSeccion>
				)}
			</div>

			{/* Alertas */}
			{alertas.length > 0 && (
				<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20 }}>
					<h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 14 }}>📊 Análisis Automático</h3>
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						{alertas.map((a, i) => (
							<div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, backgroundColor: a.color + "0a", border: `1px solid ${a.color}22` }}>
								<a.icon size={18} color={a.color} style={{ flexShrink: 0 }} />
								<p style={{ fontSize: 14, color: "#374151", margin: 0, fontWeight: 500 }}>{a.msg}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Tabla */}
			<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
				<div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
					<h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>Listado de Equipos ({tablaData.length})</h3>
					<div style={{ display: "flex", gap: 6 }}>
						{ESTADOS_PILLS.map(p => (
							<button key={p.id} onClick={() => { setFiltroEstado(p.id); setPagina(1); }}
								style={{ padding: "5px 12px", borderRadius: 20, border: filtroEstado === p.id ? `2px solid ${p.color}` : "1px solid #e5e7eb", backgroundColor: filtroEstado === p.id ? p.color + "14" : "#fff", color: filtroEstado === p.id ? p.color : "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
								{p.label}
							</button>
						))}
					</div>
				</div>
				<div style={{ overflowX: "auto" }}>
					<table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								{[
									{ key: "codigo_activo", label: "Código" },
									{ key: "nombre", label: "Nombre" },
									{ key: "estatus_general", label: "Estado" },
									{ key: "cantidad_total", label: "Cantidad" },
									{ key: "laboratorio_nombre", label: "Laboratorio" },
								].map(c => (
									<th key={c.key} onClick={() => toggleSort(c.key)} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
										<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{c.label} <SortIcon col={c.key} /></span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{paginatedData.length === 0 && (
								<tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>No se encontraron equipos</td></tr>
							)}
							{paginatedData.map((e, i) => (
								<tr key={e.id || i} style={{ borderBottom: "1px solid #f3f4f6" }}>
									<td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{e.codigo_activo}</td>
									<td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#111827" }}>{e.nombre}</td>
									<td style={{ padding: "12px 16px" }}>{estadoBadge(e.estatus_general)}</td>
									<td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>{e.cantidad_total}</td>
									<td style={{ padding: "12px 16px", fontSize: 13, color: "#6b7280" }}>{e.laboratorio_nombre || "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{totalPages > 1 && (
					<div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fafafa" }}>
						<span style={{ fontSize: 13, color: "#6b7280" }}>Página <strong>{pagina}</strong> de <strong>{totalPages}</strong></span>
						<div style={{ display: "flex", gap: 8 }}>
							<button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", fontSize: 13, fontWeight: 600, cursor: pagina === 1 ? "not-allowed" : "pointer", color: pagina === 1 ? "#9ca3af" : "#374151" }}>Anterior</button>
							<button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina === totalPages} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", fontSize: 13, fontWeight: 600, cursor: pagina === totalPages ? "not-allowed" : "pointer", color: pagina === totalPages ? "#9ca3af" : "#374151" }}>Siguiente</button>
						</div>
					</div>
				)}
			</div>

			</div>{/* end exportable section */}
		</div>
	);
}
