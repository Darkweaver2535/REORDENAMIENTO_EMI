const CONFIG = {
	bueno:         { label: "Bueno",         bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
	regular:       { label: "Regular",       bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" },
	malo:          { label: "Malo",          bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
	disponible:    { label: "Disponible",    bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
	en_uso:        { label: "En Uso",        bg: "#eff6ff", color: "#1e40af", dot: "#3b82f6" },
	mantenimiento: { label: "Mantenimiento", bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" },
	baja:          { label: "Baja",          bg: "#fef2f2", color: "#991b1b", dot: "#ef4444" },
	en_traslado:   { label: "En Traslado",   bg: "#f5f3ff", color: "#5b21b6", dot: "#8b5cf6" },
};

export default function EstadoBadge({ estado }) {
	const cfg = CONFIG[estado] || { label: estado || "—", bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" };
	return (
		<span style={{
			display: "inline-flex", alignItems: "center", gap: 6,
			padding: "4px 10px", borderRadius: 20,
			backgroundColor: cfg.bg, color: cfg.color,
			fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
		}}>
			<span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: cfg.dot, flexShrink: 0 }} />
			{cfg.label}
		</span>
	);
}
