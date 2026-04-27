import { Search, X, RotateCcw } from "lucide-react";

const ESTADOS = [
	{ id: "", label: "Todos", dot: "#9ca3af" },
	{ id: "bueno", label: "Bueno", dot: "#22c55e" },
	{ id: "regular", label: "Regular", dot: "#f59e0b" },
	{ id: "malo", label: "Malo", dot: "#ef4444" },
];

const selectStyle = {
	width: "100%", height: 42, borderRadius: 8,
	border: "1px solid #d1d5db", padding: "0 12px",
	fontSize: 14, fontWeight: 500, color: "#111827",
	backgroundColor: "#fff", outline: "none",
};

const labelStyle = {
	display: "block", fontSize: 12, fontWeight: 700,
	color: "#9ca3af", textTransform: "uppercase",
	letterSpacing: "0.05em", marginBottom: 8,
};

export default function FiltrosEquipos({ filtros, setFiltros, unidades, laboratorios, onReset }) {
	const labsFiltrados = filtros.unidad_academica
		? laboratorios.filter(l => String(l.unidad_academica_id) === String(filtros.unidad_academica))
		: laboratorios;

	const set = (key, val) => setFiltros(prev => ({ ...prev, [key]: val }));

	return (
		<div style={{
			width: 260, flexShrink: 0, backgroundColor: "#fff",
			border: "1px solid #e5e7eb", borderRadius: 14,
			padding: 20, display: "flex", flexDirection: "column", gap: 20,
			alignSelf: "flex-start", position: "sticky", top: 0,
		}}>
			<h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>Filtros</h3>

			{/* Búsqueda */}
			<div>
				<label style={labelStyle}>Buscar</label>
				<div style={{ position: "relative" }}>
					<Search size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: 13 }} />
					<input
						type="text"
						placeholder="Nombre, código..."
						value={filtros.busqueda}
						onChange={e => set("busqueda", e.target.value)}
						style={{ ...selectStyle, paddingLeft: 36 }}
					/>
				</div>
			</div>

			{/* UA */}
			<div>
				<label style={labelStyle}>Unidad Académica</label>
				<select value={filtros.unidad_academica} onChange={e => { set("unidad_academica", e.target.value); set("laboratorio", ""); }} style={selectStyle}>
					<option value="">Todas</option>
					{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
				</select>
			</div>

			{/* Lab */}
			<div>
				<label style={labelStyle}>Laboratorio</label>
				<select value={filtros.laboratorio} onChange={e => set("laboratorio", e.target.value)} style={selectStyle}>
					<option value="">Todos</option>
					{labsFiltrados.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
				</select>
			</div>

			{/* Estado */}
			<div>
				<label style={labelStyle}>Estado</label>
				<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					{ESTADOS.map(s => (
						<label key={s.id} style={{
							display: "flex", alignItems: "center", gap: 8,
							padding: "6px 10px", borderRadius: 8, cursor: "pointer",
							backgroundColor: filtros.estado === s.id ? "#f0f9ff" : "transparent",
							border: filtros.estado === s.id ? "1px solid #bfdbfe" : "1px solid transparent",
							fontSize: 13, fontWeight: 600, color: "#374151",
						}}>
							<input
								type="radio" name="estado" value={s.id}
								checked={filtros.estado === s.id}
								onChange={e => set("estado", e.target.value)}
								style={{ display: "none" }}
							/>
							<span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
							{s.label}
						</label>
					))}
				</div>
			</div>

			{/* Reset */}
			<button onClick={onReset} style={{
				display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
				padding: "10px 0", borderRadius: 8, border: "1px solid #e5e7eb",
				backgroundColor: "#fff", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer",
			}} className="hover:bg-gray-50">
				<RotateCcw size={14} /> Limpiar filtros
			</button>
		</div>
	);
}
