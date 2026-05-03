import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft, MapPin, Building2, Calendar, Hash, Wrench, ArrowLeftRight,
	ClipboardCheck, Plus, Pencil, Trash2, AlertTriangle, Clock,
	Settings, Sparkles, Hammer, Scale,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { ROLES, API_ROUTES } from "../../constants/api";
import { useAuth } from "../../store/AuthContext";
import { Navigate } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import Button from "../../components/ui/Button";
import FotoEquipo from "../../components/equipos/FotoEquipo";
import EstadoBadge from "../../components/equipos/EstadoBadge";
import EspecificacionesTable from "../../components/equipos/EspecificacionesTable";
import ModalMantenimiento from "../../components/mantenimientos/ModalMantenimiento";

/* ── Helpers ─────────────────────────────────────────────────── */
const unwrap = (d) => d?.data?.data ?? d?.data ?? d;
const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const formatDate = (d) => {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
};

/* ── Tab config ──────────────────────────────────────────────── */
const TABS = [
	{ id: "specs", label: "Especificaciones", icon: Wrench },
	{ id: "historial", label: "Historial Movimientos", icon: ArrowLeftRight },
	{ id: "bitacora", label: "Bitácora", icon: ClipboardCheck },
];

const TIPO_ICON = {
	preventivo: Wrench,
	correctivo: Settings,
	limpieza: Sparkles,
	reparacion: Hammer,
	calibracion: Scale,
	verificacion: ClipboardCheck,
};
const ESTADO_STYLE = {
	realizado:  { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
	pendiente:  { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
	en_proceso: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
	cancelado:  { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
};

/* ── InfoRow ─────────────────────────────────────────────────── */
function InfoRow({ label, value, icon: Icon }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
			{Icon && <Icon size={15} color="#9ca3af" style={{ flexShrink: 0 }} />}
			<span style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", minWidth: 100 }}>{label}</span>
			<span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{value || "—"}</span>
		</div>
	);
}

/* ── Main ────────────────────────────────────────────────────── */
export default function EquipoDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { hasRole } = useAuth();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("specs");
	const [modalOpen, setModalOpen] = useState(false);
	const [registroEditar, setRegistroEditar] = useState(null);

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS)) return <Navigate to="/dashboard" replace />;

	/* ── Queries ──────────────────────────────────────────────── */
	const { data: eqData, isLoading } = useQuery({
		queryKey: ["equipo-detail", id],
		queryFn: () => axiosClient.get(API_ROUTES.LABORATORIOS.EQUIPO_DETALLE(id)),
		enabled: Boolean(id),
	});
	const equipo = useMemo(() => unwrap(eqData), [eqData]);

	const { data: reordData } = useQuery({
		queryKey: ["equipo-reord", id],
		queryFn: () => axiosClient.get(API_ROUTES.REORDENAMIENTO.BASE, { params: { page_size: 100 } }),
		enabled: Boolean(id),
	});
	const reordenamientos = normalize(reordData);

	const { data: mantData, isLoading: loadingMant } = useQuery({
		queryKey: ["mantenimientos", id],
		queryFn: () => axiosClient.get(API_ROUTES.MANTENIMIENTOS.BY_EQUIPO(id)),
		enabled: Boolean(id) && activeTab === "bitacora",
	});
	const registros = normalize(mantData);

	/* ── Handlers ─────────────────────────────────────────────── */
	const handleEliminar = async (regId) => {
		if (!window.confirm("¿Eliminar este registro de la bitácora?")) return;
		try {
			await axiosClient.delete(API_ROUTES.MANTENIMIENTOS.DELETE(regId));
			queryClient.invalidateQueries(["mantenimientos", id]);
		} catch (e) {
			console.error("Error eliminando:", e);
		}
	};

	/* ── Loading / Error ──────────────────────────────────────── */
	if (isLoading) {
		return (
			<PageWrapper title="Cargando equipo...">
				<div style={{ display: "flex", gap: 24 }}>
					<div style={{ width: 280, height: 220, borderRadius: 14, backgroundColor: "#f3f4f6" }} className="animate-pulse" />
					<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
						{[1,2,3,4,5].map(i => <div key={i} style={{ height: 20, width: `${60 + i * 5}%`, borderRadius: 6, backgroundColor: "#f3f4f6" }} className="animate-pulse" />)}
					</div>
				</div>
			</PageWrapper>
		);
	}

	if (!equipo) {
		return (
			<PageWrapper title="Equipo no encontrado">
				<p style={{ color: "#6b7280" }}>No se pudo cargar el equipo.</p>
				<Button variant="secondary" onClick={() => navigate("/equipos")}>Volver</Button>
			</PageWrapper>
		);
	}

	/* ── Maintenance alerts ───────────────────────────────────── */
	const tieneVencidos = registros.some(r => r.dias_para_proximo !== null && r.dias_para_proximo < 0);
	const tienePorVencer = registros.some(r => r.dias_para_proximo !== null && r.dias_para_proximo >= 0 && r.dias_para_proximo <= 30);

	return (
		<>
			<PageWrapper
				title={equipo.nombre || "Equipo"}
				description={`Código: ${equipo.codigo_activo}`}
				actions={
					<Button variant="secondary" onClick={() => navigate("/equipos")}>
						<ArrowLeft size={18} /> Volver a Equipos
					</Button>
				}
			>
				{/* Header: Foto + Info */}
				<div style={{
					display: "flex", gap: 28, marginBottom: 28, flexWrap: "wrap",
					backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
					padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
				}}>
					<div style={{ width: 260, flexShrink: 0 }}>
						<FotoEquipo url={equipo.foto_url} nombre={equipo.nombre} size="lg" />
					</div>
					<div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 4 }}>
						<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
							<EstadoBadge estado={equipo.estatus_general} />
							<span style={{ fontSize: 13, fontFamily: "monospace", color: "#9ca3af", fontWeight: 600 }}>{equipo.codigo_activo}</span>
						</div>
						<h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>{equipo.nombre}</h1>
						<div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
							<InfoRow label="Laboratorio" value={equipo.laboratorio_nombre} icon={MapPin} />
							<InfoRow label="Ubicación" value={equipo.ubicacion_sala} icon={Building2} />
							<InfoRow label="Cantidad Total" value={equipo.cantidad_total} icon={Hash} />
							<InfoRow label="Buenos / Regular / Malos" value={`${equipo.cantidad_buena || 0} / ${equipo.cantidad_regular || 0} / ${equipo.cantidad_mala || 0}`} />
							<InfoRow label="Evaluado" value={equipo.evaluado_en ? formatDate(equipo.evaluado_en) : "Sin evaluar"} icon={Calendar} />
							{equipo.evaluado_por_nombre && <InfoRow label="Evaluado por" value={equipo.evaluado_por_nombre} />}
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
					{TABS.map(t => {
						const active = activeTab === t.id;
						return (
							<button key={t.id} onClick={() => setActiveTab(t.id)} style={{
								display: "inline-flex", alignItems: "center", gap: 8,
								padding: "12px 20px", border: "none",
								borderBottom: active ? "3px solid #002B5E" : "3px solid transparent",
								backgroundColor: "transparent", color: active ? "#002B5E" : "#6b7280",
								fontSize: 14, fontWeight: active ? 800 : 600, cursor: "pointer",
								marginBottom: -2, whiteSpace: "nowrap",
							}}>
								<t.icon size={16} /> {t.label}
							</button>
						);
					})}
				</div>

				{/* ═══ Tab: Especificaciones ═══ */}
				{activeTab === "specs" && (
					<EspecificacionesTable
						specs={equipo.especificaciones}
						notas={equipo.notas || equipo.observaciones}
					/>
				)}

				{/* ═══ Tab: Historial Movimientos ═══ */}
				{activeTab === "historial" && (
					<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 24 }}>
						{reordenamientos.length === 0 ? (
							<div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
								<ArrowLeftRight size={36} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
								<p style={{ fontSize: 15, fontWeight: 700 }}>Sin movimientos registrados</p>
							</div>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
								{reordenamientos.slice(0, 10).map((r, i) => (
									<div key={r.id || i} style={{ display: "flex", gap: 14, paddingBottom: 16, borderBottom: i < 9 ? "1px solid #f3f4f6" : "none" }}>
										<div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
											<ArrowLeftRight size={15} color="#002B5E" />
										</div>
										<div>
											<p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
												{r.laboratorio_origen_nombre || "?"} → {r.laboratorio_destino_nombre || "?"}
											</p>
											<p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
												{r.motivo || "Reordenamiento"} · {r.estado}
											</p>
											<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
												{r.created_at ? formatDate(r.created_at) : ""}
											</p>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* ═══ Tab: Bitácora ═══ */}
				{activeTab === "bitacora" && (
					<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
						{/* Header con alertas */}
						<div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6" }}>
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<ClipboardCheck size={18} color="#002B5E" />
									<h2 style={{ fontSize: 16, fontWeight: 700, color: "#374151", margin: 0 }}>Bitácora de Mantenimiento</h2>
								</div>
								{hasRole(ROLES.ADMIN, ROLES.ENCARGADO_ACTIVOS) && (
									<button
										onClick={() => { setRegistroEditar(null); setModalOpen(true); }}
										style={{
											display: "inline-flex", alignItems: "center", gap: 6,
											padding: "8px 16px", borderRadius: 10, border: "none",
											backgroundColor: "#002B5E", color: "#fff",
											fontSize: 13, fontWeight: 700, cursor: "pointer",
											boxShadow: "0 2px 6px rgba(0,43,94,0.25)",
										}}
									>
										<Plus size={15} /> Agregar registro
									</button>
								)}
							</div>

							{/* Alerts */}
							{equipo.requiere_mantenimiento && tieneVencidos && (
								<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, backgroundColor: "#fef2f2", border: "1px solid #fecaca", marginTop: 12 }}>
									<AlertTriangle size={16} color="#dc2626" />
									<span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Tiene mantenimientos/calibraciones VENCIDOS</span>
								</div>
							)}
							{equipo.requiere_mantenimiento && !tieneVencidos && tienePorVencer && (
								<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, backgroundColor: "#fffbeb", border: "1px solid #fde68a", marginTop: 12 }}>
									<Clock size={16} color="#d97706" />
									<span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>Tiene servicio(s) programado(s) en los próximos 30 días</span>
								</div>
							)}
						</div>

						{/* Timeline */}
						<div style={{ padding: 24 }}>
							{loadingMant ? (
								<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
									{[1,2,3].map(i => (
										<div key={i} style={{ display: "flex", gap: 16 }}>
											<div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
											<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
												<div style={{ height: 14, width: "60%", borderRadius: 6, backgroundColor: "#f3f4f6" }} className="animate-pulse" />
												<div style={{ height: 12, width: "40%", borderRadius: 6, backgroundColor: "#f3f4f6" }} className="animate-pulse" />
											</div>
										</div>
									))}
								</div>
							) : registros.length === 0 ? (
								<div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
									<Wrench size={36} color="#d1d5db" style={{ margin: "0 auto 12px", opacity: 0.5 }} />
									<p style={{ fontSize: 15, fontWeight: 700, color: "#6b7280" }}>Sin registros en la bitácora</p>
									<p style={{ fontSize: 13, marginTop: 6 }}>
										{equipo.requiere_mantenimiento
											? "Agrega el primer mantenimiento o calibración"
											: "Este equipo no requiere mantenimiento periódico"}
									</p>
								</div>
							) : (
								<div style={{ display: "flex", flexDirection: "column" }}>
									{registros.map((r, i) => {
										const Icon = TIPO_ICON[r.tipo] || Wrench;
										const est = ESTADO_STYLE[r.estado] || ESTADO_STYLE.realizado;
										const vencido = r.dias_para_proximo !== null && r.dias_para_proximo < 0;

										return (
											<div key={r.id} style={{ display: "flex", gap: 16, position: "relative" }}>
												{/* Timeline line */}
												{i < registros.length - 1 && (
													<div style={{
														position: "absolute", left: 19, top: 44, bottom: 0,
														width: 2, backgroundColor: "#e5e7eb",
													}} />
												)}
												{/* Icon circle */}
												<div style={{
													width: 40, height: 40, borderRadius: "50%",
													backgroundColor: "#f9fafb", border: "2px solid #e5e7eb",
													display: "flex", alignItems: "center", justifyContent: "center",
													flexShrink: 0, zIndex: 1,
												}}>
													<Icon size={16} color="#6b7280" />
												</div>
												{/* Content */}
												<div style={{ flex: 1, paddingBottom: 24 }}>
													<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
														<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
															<span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{r.tipo_display}</span>
															<span style={{
																fontSize: 11, fontWeight: 700, padding: "3px 10px",
																borderRadius: 20, backgroundColor: est.bg,
																color: est.color, border: `1px solid ${est.border}`,
															}}>
																{r.estado_display}
															</span>
														</div>
														{hasRole(ROLES.ADMIN, ROLES.ENCARGADO_ACTIVOS) && (
															<div style={{ display: "flex", gap: 4 }}>
																<button onClick={() => { setRegistroEditar(r); setModalOpen(true); }} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }} title="Editar">
																	<Pencil size={14} />
																</button>
																<button onClick={() => handleEliminar(r.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }} title="Eliminar">
																	<Trash2 size={14} />
																</button>
															</div>
														)}
													</div>

													<p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
														{formatDate(r.fecha_realizacion)} · {r.realizado_por_nombre}
													</p>

													<p style={{ fontSize: 14, color: "#374151", lineHeight: 1.5, marginBottom: 6 }}>
														{r.descripcion}
													</p>

													{/* Certificado */}
													{r.es_calibracion && r.numero_certificado && (
														<p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
															📄 Cert: {r.numero_certificado}
															{r.entidad_calibradora && ` · ${r.entidad_calibradora}`}
														</p>
													)}

													{/* Próximo servicio */}
													{r.fecha_proximo && (
														<p style={{
															fontSize: 12, fontWeight: 700, marginTop: 4,
															color: vencido ? "#dc2626" : "#6b7280",
														}}>
															{vencido ? "⚠️ Vencido:" : "📅 Próximo:"} {formatDate(r.fecha_proximo)}
															{vencido && ` (hace ${Math.abs(r.dias_para_proximo)} días)`}
														</p>
													)}

													{/* Observaciones */}
													{r.observaciones && (
														<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, fontStyle: "italic" }}>
															"{r.observaciones}"
														</p>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				)}
			</PageWrapper>

			{/* Modal */}
			<ModalMantenimiento
				equipoId={Number(id)}
				registro={registroEditar}
				isOpen={modalOpen}
				onClose={() => { setModalOpen(false); setRegistroEditar(null); }}
				onGuardado={() => queryClient.invalidateQueries(["mantenimientos", id])}
			/>
		</>
	);
}
