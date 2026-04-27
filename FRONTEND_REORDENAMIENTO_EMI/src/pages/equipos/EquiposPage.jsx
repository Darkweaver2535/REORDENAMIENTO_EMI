import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, LayoutGrid, List, X, Package } from "lucide-react";
import { fetchLaboratorios, fetchEquipos } from "../../api/laboratoriosApi";
import axiosClient from "../../api/axiosClient";
import { ROLES, API_ROUTES } from "../../constants/api";
import { useAuth } from "../../store/AuthContext";
import { Navigate } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import EquipoCard from "../../components/equipos/EquipoCard";
import EquipoListRow from "../../components/equipos/EquipoListRow";
import FiltrosEquipos from "../../components/equipos/FiltrosEquipos";

const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };

const INIT_FILTROS = { unidad_academica: "", laboratorio: "", estado: "", busqueda: "" };

export default function EquiposPage() {
	const { hasRole } = useAuth();
	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS)) return <Navigate to="/dashboard" replace />;

	const [vistaGrilla, setVistaGrilla] = useState(true);
	const [filtros, setFiltros] = useState(INIT_FILTROS);
	const [pagina, setPagina] = useState(1);
	const PER_PAGE = 15;

	/* ── Queries ──────────────────────────────────────── */
	const { data: uaData } = useQuery({ queryKey: ["unidades"], queryFn: () => axiosClient.get(API_ROUTES.ESTRUCTURA.UNIDADES), staleTime: 5 * 60 * 1000 });
	const unidades = normalize(uaData);

	const { data: labsData } = useQuery({ queryKey: ["laboratorios"], queryFn: fetchLaboratorios, staleTime: 5 * 60 * 1000 });
	const laboratorios = normalize(labsData);

	const { data: eqData, isLoading } = useQuery({ queryKey: ["all-equipos"], queryFn: () => fetchEquipos({ page_size: 1000 }), staleTime: 3 * 60 * 1000 });
	const allEquipos = normalize(eqData);

	/* ── Filtrado ─────────────────────────────────────── */
	const equiposFiltrados = useMemo(() => {
		let data = allEquipos;
		if (filtros.unidad_academica) {
			const labIds = laboratorios.filter(l => String(l.unidad_academica_id) === String(filtros.unidad_academica)).map(l => l.id);
			data = data.filter(e => labIds.includes(e.laboratorio_id));
		}
		if (filtros.laboratorio) data = data.filter(e => String(e.laboratorio_id) === String(filtros.laboratorio));
		if (filtros.estado) data = data.filter(e => e.estatus_general === filtros.estado);
		if (filtros.busqueda) {
			const q = filtros.busqueda.toLowerCase();
			data = data.filter(e => (e.nombre || "").toLowerCase().includes(q) || (e.codigo_activo || "").toLowerCase().includes(q));
		}
		return data;
	}, [allEquipos, filtros, laboratorios]);

	/* ── Enrich con UA nombre ─────────────────────────── */
	const equiposEnriquecidos = useMemo(() => {
		const labMap = {};
		laboratorios.forEach(l => { labMap[l.id] = l; });
		const uaMap = {};
		unidades.forEach(u => { uaMap[u.id] = u; });
		return equiposFiltrados.map(e => {
			const lab = labMap[e.laboratorio_id];
			const ua = lab ? uaMap[lab.unidad_academica_id] : null;
			return { ...e, laboratorio_nombre: e.laboratorio_nombre || lab?.nombre || "—", unidad_academica_nombre: ua?.nombre || "" };
		});
	}, [equiposFiltrados, laboratorios, unidades]);

	const totalPages = Math.ceil(equiposEnriquecidos.length / PER_PAGE) || 1;
	const paginatedData = equiposEnriquecidos.slice((pagina - 1) * PER_PAGE, pagina * PER_PAGE);

	/* ── Active filter chips ──────────────────────────── */
	const chips = [];
	if (filtros.unidad_academica) { const u = unidades.find(u => String(u.id) === String(filtros.unidad_academica)); if (u) chips.push({ key: "unidad_academica", label: `UA: ${u.nombre}` }); }
	if (filtros.laboratorio) { const l = laboratorios.find(l => String(l.id) === String(filtros.laboratorio)); if (l) chips.push({ key: "laboratorio", label: `Lab: ${l.nombre}` }); }
	if (filtros.estado) chips.push({ key: "estado", label: `Estado: ${filtros.estado}` });
	if (filtros.busqueda) chips.push({ key: "busqueda", label: `"${filtros.busqueda}"` });

	const removeChip = (key) => setFiltros(prev => ({ ...prev, [key]: "" }));
	const resetFiltros = () => { setFiltros(INIT_FILTROS); setPagina(1); };

	/* ── Skeleton cards ──────────────────────────────── */
	const SkeletonCard = () => (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
			<div style={{ height: 160, backgroundColor: "#f3f4f6" }} className="animate-pulse" />
			<div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
				<div style={{ height: 14, width: "40%", backgroundColor: "#f3f4f6", borderRadius: 6 }} className="animate-pulse" />
				<div style={{ height: 18, width: "80%", backgroundColor: "#f3f4f6", borderRadius: 6 }} className="animate-pulse" />
				<div style={{ height: 12, width: "60%", backgroundColor: "#f3f4f6", borderRadius: 6 }} className="animate-pulse" />
			</div>
		</div>
	);

	return (
		<PageWrapper title="Equipos" description="Explora y busca equipos por laboratorio, tipo o estado.">
			<div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

				{/* Filtros sidebar */}
				<FiltrosEquipos filtros={filtros} setFiltros={(fn) => { setFiltros(fn); setPagina(1); }} unidades={unidades} laboratorios={laboratorios} onReset={resetFiltros} />

				{/* Main content */}
				<div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

					{/* Top bar */}
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
							<span style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>
								{equiposEnriquecidos.length} equipo{equiposEnriquecidos.length !== 1 ? "s" : ""}
							</span>
							{chips.map(c => (
								<span key={c.key} style={{
									display: "inline-flex", alignItems: "center", gap: 4,
									padding: "4px 10px", borderRadius: 20,
									backgroundColor: "#eff6ff", color: "#1e40af",
									fontSize: 12, fontWeight: 700,
								}}>
									{c.label}
									<button onClick={() => removeChip(c.key)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#1e40af", padding: 0 }}>
										<X size={12} />
									</button>
								</span>
							))}
						</div>
						<div style={{ display: "flex", gap: 4 }}>
							<button onClick={() => setVistaGrilla(true)} style={{
								width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
								border: "1px solid #e5e7eb", backgroundColor: vistaGrilla ? "#002B5E" : "#fff", color: vistaGrilla ? "#fff" : "#6b7280", cursor: "pointer",
							}}><LayoutGrid size={17} /></button>
							<button onClick={() => setVistaGrilla(false)} style={{
								width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
								border: "1px solid #e5e7eb", backgroundColor: !vistaGrilla ? "#002B5E" : "#fff", color: !vistaGrilla ? "#fff" : "#6b7280", cursor: "pointer",
							}}><List size={17} /></button>
						</div>
					</div>

					{/* Loading */}
					{isLoading && vistaGrilla && (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
							{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
						</div>
					)}

					{/* Empty */}
					{!isLoading && equiposEnriquecidos.length === 0 && (
						<div style={{ textAlign: "center", padding: "64px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1px solid #e5e7eb" }}>
							<Package size={48} color="#d1d5db" style={{ margin: "0 auto 16px" }} />
							<p style={{ fontSize: 17, fontWeight: 700, color: "#374151" }}>No se encontraron equipos</p>
							<p style={{ fontSize: 14, color: "#9ca3af", marginTop: 6 }}>Intenta con otros filtros</p>
							<button onClick={resetFiltros} style={{
								marginTop: 16, padding: "10px 24px", borderRadius: 8,
								backgroundColor: "#002B5E", color: "#fff", fontSize: 14, fontWeight: 700,
								border: "none", cursor: "pointer",
							}}>Limpiar filtros</button>
						</div>
					)}

					{/* Grid view */}
					{!isLoading && vistaGrilla && equiposEnriquecidos.length > 0 && (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
							{paginatedData.map(e => <EquipoCard key={e.id} equipo={e} />)}
						</div>
					)}

					{/* List view */}
					{!isLoading && !vistaGrilla && equiposEnriquecidos.length > 0 && (
						<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
							<table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
								<thead>
									<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
										{["", "Equipo", "Estado", "Laboratorio", "UA", ""].map((h, i) => (
											<th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{paginatedData.map((e, i) => <EquipoListRow key={e.id} equipo={e} idx={i} total={paginatedData.length} />)}
								</tbody>
							</table>
						</div>
					)}

					{/* Pagination */}
					{!isLoading && totalPages > 1 && (
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
							<span style={{ fontSize: 13, color: "#6b7280" }}>Página <strong>{pagina}</strong> de <strong>{totalPages}</strong></span>
							<div style={{ display: "flex", gap: 8 }}>
								<button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", fontSize: 13, fontWeight: 600, cursor: pagina === 1 ? "not-allowed" : "pointer", color: pagina === 1 ? "#9ca3af" : "#374151" }}>Anterior</button>
								<button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina === totalPages} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", fontSize: 13, fontWeight: 600, cursor: pagina === totalPages ? "not-allowed" : "pointer", color: pagina === totalPages ? "#9ca3af" : "#374151" }}>Siguiente</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</PageWrapper>
	);
}
