import { useState, useEffect } from "react";
import { Maximize2, X } from "lucide-react";

/**
 * Wrapper para gráficos Recharts.
 *
 * Resuelve el warning "width(-1) / height(-1)" de tres formas:
 *  1. minWidth: 0          → evita desbordamiento en flex/grid
 *  2. montaje diferido     → espera a que el DOM calcule dimensiones
 *  3. altura fija interna  → el div del chart tiene height explícito
 *     sin padding que reduzca el espacio útil
 */
export default function GraficoSeccion({ titulo, subtitulo, children, isLoading }) {
	const [expanded, setExpanded] = useState(false);
	const [montado, setMontado] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => setMontado(true), 80);
		return () => clearTimeout(t);
	}, []);

	if (isLoading) {
		return (
			<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px", minHeight: "280px" }}>
				<div style={{ height: 16, width: "40%", backgroundColor: "#f3f4f6", borderRadius: 6, marginBottom: 12 }} className="animate-pulse" />
				<div style={{ height: 200, backgroundColor: "#f9fafb", borderRadius: 10 }} className="animate-pulse" />
			</div>
		);
	}

	if (expanded) {
		return (
			<div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
				<div style={{ backgroundColor: "#fff", borderRadius: 16, width: "100%", maxWidth: 1000, maxHeight: "90vh", overflow: "auto", padding: 32, position: "relative" }}>
					<button onClick={() => setExpanded(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={22} /></button>
					<h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{titulo}</h3>
					{subtitulo && <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>{subtitulo}</p>}
					<div style={{ height: 500, minWidth: 0 }}>{children}</div>
				</div>
			</div>
		);
	}

	return (
		<div style={{
			backgroundColor: "#fff",
			border: "1px solid #e5e7eb",
			borderRadius: "14px",
			boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
			minWidth: 0,          /* FIX 1: prevent flex/grid overflow */
		}}>
			{/* Header */}
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
				<div>
					<h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: 0 }}>{titulo}</h3>
					{subtitulo && <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0", fontWeight: 500 }}>{subtitulo}</p>}
				</div>
				<button onClick={() => setExpanded(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 4 }} title="Expandir">
					<Maximize2 size={16} />
				</button>
			</div>

			{/* Chart area — padding is OUTSIDE the height so ResponsiveContainer gets the full 248px */}
			<div style={{ padding: "16px 20px" }}>
				<div style={{ width: "100%", height: 248, minWidth: 0 }}>
					{montado ? children : (
						<div style={{ height: "100%", backgroundColor: "#f9fafb", borderRadius: 10 }} className="animate-pulse" />
					)}
				</div>
			</div>
		</div>
	);
}

export const COLORES_ESTADO = {
	bueno: "#22c55e",
	regular: "#f59e0b",
	malo: "#ef4444",
	disponible: "#22c55e",
	en_uso: "#3b82f6",
	mantenimiento: "#f59e0b",
	baja: "#ef4444",
	en_traslado: "#8b5cf6",
};
