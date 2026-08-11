// src/components/ui/GuiaCard.jsx
import { useState } from "react";
import { Download, FileText, MoreVertical, Pencil, Calendar } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { ROLES } from "../../constants/api";

const PLACEHOLDER_IMAGE =
	"https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80";

function formatDate(dateStr) {
	if (!dateStr) return "Sin fecha";
	return new Date(dateStr).toLocaleDateString("es-BO", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export default function GuiaCard({ guia, onEdit }) {
	const { hasRole } = useAuth();
	const [menuOpen, setMenuOpen] = useState(false);



	const isManager = hasRole(ROLES.ADMIN, ROLES.JEFE);
	const pdfUrl = guia?.pdf_url || null;
	const portada = guia?.portada_url || null;
	const numero = guia?.numero ?? guia?.numero_practica ?? "";
	const titulo = guia?.titulo ?? guia?.nombre ?? "Sin título";
	const asignatura = guia?.asignatura_nombre ?? guia?.asignatura ?? "";
	const autor = guia?.autor ?? guia?.docente_nombre ?? guia?.docente ?? "";
	const fecha = guia?.fecha_creacion ?? guia?.created_at ?? guia?.fecha ?? null;

	return (
		<article
			style={{
				backgroundColor: "#ffffff",
				border: "1px solid #e5e7eb",
				borderRadius: "14px",
				overflow: "hidden",
				boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
				display: "flex",
				flexDirection: "column",
				transition: "box-shadow 200ms ease, border-color 200ms ease",
			}}
			className="hover:shadow-lg hover:border-gray-300"
		>
			{/* ── Imagen / Placeholder ─────────────────────────────── */}
			<div style={{ position: "relative", aspectRatio: "8.5 / 11", overflow: "hidden", backgroundColor: "#f3f4f6", flexShrink: 0 }}>
				{portada ? (
					<img
						src={portada}
						alt={titulo}
						style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 400ms ease" }}
						className="group-hover:scale-105"
						onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
					/>
				) : (
					<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
						<FileText size={40} color="#d1d5db" />
						<span style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500 }}>Sin portada</span>
					</div>
				)}

			</div>

			{/* ── Cuerpo ───────────────────────────────────────────── */}
			<div style={{ padding: "20px 20px 0 20px", flex: 1 }}>
				{/* Asignatura */}
				{asignatura && (
					<p style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>
						{asignatura}
					</p>
				)}

				{/* Título */}
				<h3 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", lineHeight: 1.3, letterSpacing: "-0.01em", marginBottom: "10px" }}>
					{numero ? `Práctica ${numero}: ` : ""}{titulo}
				</h3>

				{/* Metadatos */}
				<div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
					{autor && (
						<span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>
							{autor}
						</span>
					)}
					{fecha && (
						<span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#9ca3af", fontWeight: 500 }}>
							<Calendar size={13} />
							{formatDate(fecha)}
						</span>
					)}
				</div>
			</div>

			{/* ── Footer ───────────────────────────────────────────── */}
			<div style={{ padding: "16px 20px 20px 20px", display: "flex", gap: "10px", alignItems: "center", marginTop: "16px" }}>

				{/* Botón Descargar — ocupado todo el ancho disponible */}
				{pdfUrl ? (
					<a
						href={pdfUrl}
						target="_blank"
						rel="noopener noreferrer"
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "8px",
							height: "44px",
							borderRadius: "10px",
							backgroundColor: "#004F9F",
							color: "#ffffff",
							fontSize: "15px",
							fontWeight: 700,
							textDecoration: "none",
							boxShadow: "0 2px 8px rgba(0, 79, 159,0.25)",
							transition: "all 150ms ease",
						}}
						className="hover:opacity-90"
					>
						<Download size={18} />
						Descargar
					</a>
				) : (
					<span
						style={{
							flex: 1,
							display: "flex", alignItems: "center", justifyContent: "center",
							gap: "8px", height: "44px", borderRadius: "10px",
							backgroundColor: "#f3f4f6", color: "#9ca3af",
							fontSize: "15px", fontWeight: 600,
							cursor: "not-allowed",
						}}
					>
						<Download size={18} />
						Sin PDF
					</span>
				)}

				{/* Menú de acciones (solo admin/jefe) */}
				{isManager && (
					<div style={{ position: "relative" }}>
						<button
							onClick={() => setMenuOpen((p) => !p)}
							style={{
								width: "44px", height: "44px", borderRadius: "10px",
								border: "1px solid #e5e7eb",
								backgroundColor: "#ffffff",
								display: "flex", alignItems: "center", justifyContent: "center",
								color: "#6b7280", cursor: "pointer",
								flexShrink: 0,
							}}
							aria-label="Más opciones"
						>
							<MoreVertical size={18} />
						</button>

						{menuOpen && (
							<>
								{/* Backdrop para cerrar */}
								<div
									style={{ position: "fixed", inset: 0, zIndex: 10 }}
									onClick={() => setMenuOpen(false)}
								/>
								<div
									style={{
										position: "absolute",
										bottom: "calc(100% + 6px)",
										right: 0,
										zIndex: 20,
										backgroundColor: "#ffffff",
										border: "1px solid #e5e7eb",
										borderRadius: "12px",
										boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
										overflow: "hidden",
										minWidth: "160px",
									}}
								>
									<button
										onClick={() => { setMenuOpen(false); onEdit?.(guia); }}
										style={{
											display: "flex", alignItems: "center", gap: "10px",
											width: "100%", padding: "12px 16px",
											backgroundColor: "transparent", border: "none",
											fontSize: "14px", fontWeight: 600, color: "#374151",
											cursor: "pointer", textAlign: "left",
										}}
										className="hover:bg-gray-50"
									>
										<Pencil size={16} />
										Editar
									</button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</article>
	);
}
