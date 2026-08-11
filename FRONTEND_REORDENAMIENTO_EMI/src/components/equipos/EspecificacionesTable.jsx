import { Wrench, Pencil } from "lucide-react";
import { agrupar, formatearValor } from "./especificacionesMeta";

/**
 * Read-only table display for equipment specifications.
 * @param {{ specs: object, notas: string, onEdit: () => void }} props
 */
export default function EspecificacionesTable({ specs = {}, notas = "", onEdit }) {
	const grupos = agrupar(specs || {});
	const entries = Object.entries(specs || {});

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
			{entries.length === 0 ? (
				<div
					style={{
						textAlign: "center",
						padding: "40px 20px",
						backgroundColor: "#f9fafb",
						borderRadius: 14,
						border: "2px dashed #e5e7eb",
					}}
				>
					<Wrench size={36} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
					<p style={{ fontSize: 15, fontWeight: 700, color: "#9ca3af" }}>
						Sin especificaciones registradas
					</p>
					{onEdit && (
						<button
							onClick={onEdit}
							style={{
								marginTop: 12,
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "8px 18px",
								borderRadius: 8,
								backgroundColor: "#004F9F",
								color: "#fff",
								fontSize: 14,
								fontWeight: 700,
								border: "none",
								cursor: "pointer",
							}}
						>
							<Pencil size={14} />
							Agregar especificaciones
						</button>
					)}
				</div>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
					{grupos.map((grupo) => (
						<div
							key={grupo.id}
							style={{
								backgroundColor: "#fff",
								border: "1px solid #e5e7eb",
								borderRadius: 14,
								overflow: "hidden",
							}}
						>
							<div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#f9fafb" }}>
								<p style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{grupo.titulo}</p>
								{grupo.descripcion && (
									<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{grupo.descripcion}</p>
								)}
							</div>
							<table style={{ width: "100%", borderCollapse: "collapse" }}>
								<tbody>
									{grupo.filas.map(([clave, label, valor], i) => (
										<tr
											key={clave}
											style={{ borderBottom: i < grupo.filas.length - 1 ? "1px solid #f3f4f6" : "none" }}
										>
											<td
												style={{
													padding: "12px 20px",
													fontSize: 14,
													fontWeight: 700,
													color: "#374151",
													width: "34%",
													verticalAlign: "top",
												}}
											>
												{label}
											</td>
											<td
												style={{
													padding: "12px 20px",
													fontSize: 14,
													color: "#6b7280",
													fontWeight: 500,
													whiteSpace: "pre-line",
												}}
											>
												{formatearValor(valor)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				</div>
			)}

			{notas && (
				<div
					style={{
						backgroundColor: "#fffbeb",
						border: "1px solid #fde68a",
						borderRadius: 12,
						padding: "14px 18px",
					}}
				>
					<p
						style={{
							fontSize: 12,
							fontWeight: 700,
							color: "#92400e",
							textTransform: "uppercase",
							marginBottom: 6,
						}}
					>
						Notas adicionales
					</p>
					<p style={{ fontSize: 14, color: "#78350f", lineHeight: 1.5 }}>{notas}</p>
				</div>
			)}
		</div>
	);
}
