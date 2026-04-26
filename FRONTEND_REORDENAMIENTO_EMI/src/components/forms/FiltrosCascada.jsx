import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, ChevronDown } from "lucide-react";
import {
	getUnidades,
	getDepartamentos,
	getCarreras,
	getSemestres,
	getAsignaturas,
} from "../../api/guiasApi";

/* ── Helpers para normalizar respuestas paginadas o listas planas ── */
const normalizeList = (data) => {
	if (!data) return [];
	if (Array.isArray(data)) return data;
	const res = data.results ?? data.data ?? data;
	return Array.isArray(res) ? res : [];
};

const getId   = (item) => item?.id    ?? item?.pk    ?? item?.value ?? item;
const getLabel = (item) => item?.nombre ?? item?.nombre_completo ?? item?.descripcion ?? item?.titulo ?? String(getId(item) ?? "");

/* ── Select con icono de carga ───────────────────────────────────── */
function CascadeSelect({ id, label, value, onChange, options = [], loading, disabled }) {
	return (
		<div>
			<label
				htmlFor={id}
				style={{
					display: "block",
					fontSize: "14px",
					fontWeight: 700,
					color: "#374151",
					marginBottom: "8px",
				}}
			>
				{label}
			</label>

			<div style={{ position: "relative" }}>
				<select
					id={id}
					value={value}
					onChange={onChange}
					disabled={disabled || loading}
					style={{
						width: "100%",
						height: "48px",
						borderRadius: "8px",
						border: "1px solid #d1d5db",
						backgroundColor: disabled || loading ? "#f9fafb" : "#ffffff",
						paddingLeft: "16px",
						paddingRight: "44px",
						fontSize: "15px",
						fontWeight: 500,
						color: disabled || loading ? "#9ca3af" : "#111827",
						outline: "none",
						appearance: "none",
						cursor: disabled || loading ? "not-allowed" : "pointer",
						transition: "all 180ms ease",
					}}
				>
					<option value="">Selecciona…</option>
					{options.map((o) => (
						<option key={getId(o)} value={getId(o)}>
							{getLabel(o)}
						</option>
					))}
				</select>

				{/* Icono derecho: spinner si cargando, chevron si no */}
				<div
					style={{
						position: "absolute",
						right: "14px",
						top: "50%",
						transform: "translateY(-50%)",
						pointerEvents: "none",
						display: "flex",
						alignItems: "center",
						color: "#9ca3af",
					}}
				>
					{loading
						? <LoaderCircle size={18} color="#002B5E" className="animate-spin" />
						: <ChevronDown size={18} />
					}
				</div>
			</div>
		</div>
	);
}

/* ── Componente principal ────────────────────────────────────────── */
function FiltrosCascada({ onAsignaturaChange, showOnlyActive = true }) {
	const [searchParams, setSearchParams] = useSearchParams();

	// Leer filtros desde la URL
	const unidadId     = searchParams.get("unidad")     ?? "";
	const deptId       = searchParams.get("depto")       ?? "";
	const carreraId    = searchParams.get("carrera")    ?? "";
	const semestreId   = searchParams.get("semestre")   ?? "";
	const asignaturaId = searchParams.get("asignatura") ?? "";

	// Helper para actualizar la URL preservando params existentes
	const updateParams = (updates, deletes = []) => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			for (const key of deletes) {
				next.delete(key);
			}
			for (const [key, val] of Object.entries(updates)) {
				if (val) {
					next.set(key, val);
				} else {
					next.delete(key);
				}
			}
			return next;
		}, { replace: true });
	};

	/* ── Queries ──────────────────────────────────────────────────── */
	const { data: unidadesRaw, isLoading: loadingUnidades } = useQuery({
		queryKey: ["unidades"],
		queryFn: getUnidades,
		staleTime: 5 * 60 * 1000,
	});

	const { data: deptsRaw, isLoading: loadingDepts } = useQuery({
		queryKey: ["departamentos", unidadId],
		queryFn: () => getDepartamentos(unidadId),
		enabled: Boolean(unidadId),
	});

	const { data: carrerasRaw, isLoading: loadingCarreras } = useQuery({
		queryKey: ["carreras", deptId],
		queryFn: () => getCarreras(deptId),
		enabled: Boolean(deptId),
	});

	const { data: semestresRaw, isLoading: loadingSemestres } = useQuery({
		queryKey: ["semestres"],
		queryFn: getSemestres,
		staleTime: 5 * 60 * 1000,
	});

	const asignaturasEnabled = Boolean(carreraId) && Boolean(semestreId) && Boolean(unidadId);

	const { data: asignaturasRaw, isLoading: loadingAsignaturas } = useQuery({
		queryKey: ["asignaturas", carreraId, semestreId, unidadId],
		queryFn: () => getAsignaturas(carreraId, semestreId, unidadId),
		enabled: asignaturasEnabled,
	});

	/* ── Listas normalizadas ─────────────────────────────────────── */
	const unidades = useMemo(() => {
		const list = normalizeList(unidadesRaw);
		if (!showOnlyActive) return list;
		return list.filter((u) => {
			const s = u?.estado ?? u?.activo ?? u?.is_active;
			if (s === undefined || s === null) return true;
			if (typeof s === "boolean") return s;
			if (typeof s === "number")  return s === 1;
			return ["activo", "active", "true", "1"].includes(String(s).toLowerCase());
		});
	}, [unidadesRaw, showOnlyActive]);

	const departamentos = useMemo(() => normalizeList(deptsRaw),       [deptsRaw]);
	const carreras      = useMemo(() => normalizeList(carrerasRaw),    [carrerasRaw]);
	const semestres     = useMemo(() => normalizeList(semestresRaw),   [semestresRaw]);
	const asignaturas   = useMemo(() => normalizeList(asignaturasRaw), [asignaturasRaw]);

	/* ── Restaurar la asignatura desde la URL al cargar datos ────── */
	useEffect(() => {
		if (!asignaturaId || asignaturas.length === 0) return;
		const found = asignaturas.find((a) => String(getId(a)) === asignaturaId);
		if (found) {
			onAsignaturaChange?.(found);
		}
	}, [asignaturas, asignaturaId]);

	/* ── Handlers en cascada ─────────────────────────────────────── */
	const handleUnidad = (e) => {
		updateParams(
			{ unidad: e.target.value },
			["depto", "carrera", "semestre", "asignatura"]
		);
		onAsignaturaChange?.(null);
	};

	const handleDept = (e) => {
		updateParams(
			{ depto: e.target.value },
			["carrera", "asignatura"]
		);
		onAsignaturaChange?.(null);
	};

	const handleCarrera = (e) => {
		updateParams(
			{ carrera: e.target.value },
			["asignatura"]
		);
		onAsignaturaChange?.(null);
	};

	const handleSemestre = (e) => {
		updateParams(
			{ semestre: e.target.value },
			["asignatura"]
		);
		onAsignaturaChange?.(null);
	};

	const handleAsignatura = (e) => {
		const id = e.target.value;
		updateParams({ asignatura: id });
		if (!id) { onAsignaturaChange?.(null); return; }
		const found = asignaturas.find((a) => String(getId(a)) === id);
		onAsignaturaChange?.(found ?? null);
	};

	/* ── Asignatura seleccionada (para mostrar resumen) ──────────── */
	const selectedAsignatura = useMemo(
		() => asignaturas.find((a) => String(getId(a)) === asignaturaId) ?? null,
		[asignaturas, asignaturaId]
	);

	return (
		<div
			style={{
				backgroundColor: "#ffffff",
				border: "1px solid #e5e7eb",
				borderRadius: "14px",
				padding: "28px",
				boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
			}}
		>
			{/* Grid de selects */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
					gap: "20px",
				}}
			>
				<CascadeSelect
					id="filtro-unidad"
					label="Unidad Académica"
					value={unidadId}
					onChange={handleUnidad}
					options={unidades}
					loading={loadingUnidades}
				/>

				<CascadeSelect
					id="filtro-dept"
					label="Departamento"
					value={deptId}
					onChange={handleDept}
					options={departamentos}
					loading={loadingDepts}
					disabled={!unidadId}
				/>

				<CascadeSelect
					id="filtro-carrera"
					label="Carrera"
					value={carreraId}
					onChange={handleCarrera}
					options={carreras}
					loading={loadingCarreras}
					disabled={!deptId}
				/>

				<CascadeSelect
					id="filtro-semestre"
					label="Semestre"
					value={semestreId}
					onChange={handleSemestre}
					options={semestres}
					loading={loadingSemestres}
				/>

				<CascadeSelect
					id="filtro-asignatura"
					label="Asignatura"
					value={asignaturaId}
					onChange={handleAsignatura}
					options={asignaturas}
					loading={loadingAsignaturas}
					disabled={!asignaturasEnabled}
				/>
			</div>

			{/* Resumen de selección */}
			{selectedAsignatura && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "10px",
						marginTop: "20px",
						paddingTop: "20px",
						borderTop: "1px solid #f3f4f6",
					}}
				>
					<span
						style={{
							width: "8px", height: "8px", borderRadius: "50%",
							backgroundColor: "#002B5E", flexShrink: 0,
						}}
					/>
					<p style={{ fontSize: "15px", fontWeight: 500, color: "#6b7280" }}>
						Asignatura seleccionada:{" "}
						<strong style={{ fontWeight: 700, color: "#111827" }}>
							{getLabel(selectedAsignatura)}
						</strong>
					</p>
				</div>
			)}
		</div>
	);
}

export default FiltrosCascada;