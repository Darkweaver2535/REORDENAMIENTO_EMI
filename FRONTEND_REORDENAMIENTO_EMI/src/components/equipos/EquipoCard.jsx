import { useNavigate } from "react-router-dom";
import { MapPin, Building2, ArrowRight } from "lucide-react";
import FotoEquipo from "./FotoEquipo";
import EstadoBadge from "./EstadoBadge";

export default function EquipoCard({ equipo }) {
	const navigate = useNavigate();
	const e = equipo;
	return (
		<div style={{
			backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
			overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
			transition: "box-shadow 200ms ease, transform 200ms ease",
			cursor: "pointer",
		}}
		className="hover:shadow-lg hover:-translate-y-0.5"
		onClick={() => navigate(`/equipos/${e.id}`)}
		>
			<div style={{ height: 160, overflow: "hidden", backgroundColor: "#f9fafb" }}>
				<FotoEquipo url={e.foto_url} nombre={e.nombre} size="md" />
			</div>
			<div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<EstadoBadge estado={e.estatus_general} />
					<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, fontFamily: "monospace" }}>{e.codigo_activo}</span>
				</div>
				<p style={{ fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.3, margin: 0 }}>{e.nombre}</p>
				<div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
					<span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
						<MapPin size={13} style={{ flexShrink: 0 }} />
						{e.laboratorio_nombre || "Sin lab."}
					</span>
					{e.unidad_academica_nombre && (
						<span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>
							<Building2 size={13} style={{ flexShrink: 0 }} />
							{e.unidad_academica_nombre}
						</span>
					)}
				</div>
				<button style={{
					display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
					marginTop: 8, padding: "8px 0", borderRadius: 8,
					backgroundColor: "#f9fafb", border: "1px solid #e5e7eb",
					color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
					width: "100%",
				}} className="hover:bg-gray-100">
					Ver detalles <ArrowRight size={14} />
				</button>
			</div>
		</div>
	);
}
