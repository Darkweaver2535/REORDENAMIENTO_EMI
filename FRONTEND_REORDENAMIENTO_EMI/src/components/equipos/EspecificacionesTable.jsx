import { Wrench, Pencil } from "lucide-react";

/**
 * Read-only table display for equipment specifications.
 * @param {{ specs: object, notas: string, onEdit: () => void }} props
 */
export default function EspecificacionesTable({ specs = {}, notas = "", onEdit }) {
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
								backgroundColor: "#002B5E",
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
				<div
					style={{
						backgroundColor: "#fff",
						border: "1px solid #e5e7eb",
						borderRadius: 14,
						overflow: "hidden",
					}}
				>
					<table style={{ width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								<th
									style={{
										padding: "12px 20px",
										textAlign: "left",
										fontSize: 12,
										fontWeight: 700,
										color: "#9ca3af",
										textTransform: "uppercase",
										letterSpacing: "0.05em",
									}}
								>
									Característica
								</th>
								<th
									style={{
										padding: "12px 20px",
										textAlign: "left",
										fontSize: 12,
										fontWeight: 700,
										color: "#9ca3af",
										textTransform: "uppercase",
										letterSpacing: "0.05em",
									}}
								>
									Valor
								</th>
							</tr>
						</thead>
						<tbody>
							{entries.map(([key, val], i) => (
								<tr
									key={key}
									style={{
										borderBottom:
											i < entries.length - 1 ? "1px solid #f3f4f6" : "none",
									}}
								>
									<td
										style={{
											padding: "12px 20px",
											fontSize: 14,
											fontWeight: 700,
											color: "#374151",
										}}
									>
										{key}
									</td>
									<td
										style={{
											padding: "12px 20px",
											fontSize: 14,
											color: "#6b7280",
											fontWeight: 500,
										}}
									>
										{String(val)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
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
