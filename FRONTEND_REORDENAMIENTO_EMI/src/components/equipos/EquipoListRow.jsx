import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import FotoEquipo from "./FotoEquipo";
import EstadoBadge from "./EstadoBadge";

export default function EquipoListRow({ equipo, idx, total }) {
	const navigate = useNavigate();
	const e = equipo;
	return (
		<tr
			style={{ borderBottom: idx < total - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}
			className="hover:bg-gray-50"
			onClick={() => navigate(`/equipos/${e.id}`)}
		>
			<td style={{ padding: "12px 16px", width: 48 }}>
				<FotoEquipo url={e.foto_url} nombre={e.nombre} size="sm" />
			</td>
			<td style={{ padding: "12px 16px" }}>
				<p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{e.nombre}</p>
				<p style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{e.codigo_activo}</p>
			</td>
			<td style={{ padding: "12px 16px" }}>
				<EstadoBadge estado={e.estatus_general} />
			</td>
			<td style={{ padding: "12px 16px", fontSize: 14, color: "#6b7280", fontWeight: 500 }}>
				{e.laboratorio_nombre || "—"}
			</td>
			<td style={{ padding: "12px 16px", fontSize: 13, color: "#9ca3af" }}>
				{e.unidad_academica_nombre || "—"}
			</td>
			<td style={{ padding: "12px 16px" }}>
				<button style={{
					display: "inline-flex", alignItems: "center", gap: 6,
					padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb",
					backgroundColor: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
				}} className="hover:bg-gray-50">
					Ver <ArrowRight size={13} />
				</button>
			</td>
		</tr>
	);
}
