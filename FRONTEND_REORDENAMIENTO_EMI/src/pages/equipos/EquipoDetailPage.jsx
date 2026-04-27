import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Building2, Calendar, Hash, Wrench, ArrowLeftRight } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { ROLES, API_ROUTES } from "../../constants/api";
import { useAuth } from "../../store/AuthContext";
import { Navigate } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import Button from "../../components/ui/Button";
import FotoEquipo from "../../components/equipos/FotoEquipo";
import EstadoBadge from "../../components/equipos/EstadoBadge";
import EspecificacionesTable from "../../components/equipos/EspecificacionesTable";

const unwrap = (d) => d?.data?.data ?? d?.data ?? d;
const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };

const TABS = [
	{ id: "specs", label: "Especificaciones", icon: Wrench },
	{ id: "historial", label: "Historial Movimientos", icon: ArrowLeftRight },
];

function InfoRow({ label, value, icon: Icon }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
			{Icon && <Icon size={15} color="#9ca3af" style={{ flexShrink: 0 }} />}
			<span style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", minWidth: 100 }}>{label}</span>
			<span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{value || "—"}</span>
		</div>
	);
}

export default function EquipoDetailPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const { hasRole } = useAuth();
	const [activeTab, setActiveTab] = useState("specs");

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS)) return <Navigate to="/dashboard" replace />;

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

	return (
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
						<InfoRow label="Evaluado" value={equipo.evaluado_en ? new Date(equipo.evaluado_en).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" }) : "Sin evaluar"} icon={Calendar} />
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

			{/* Tab content */}
			{activeTab === "specs" && (
				<EspecificacionesTable
					specs={equipo.especificaciones}
					notas={equipo.notas || equipo.observaciones}
				/>
			)}

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
											{r.created_at ? new Date(r.created_at).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" }) : ""}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

		</PageWrapper>
	);
}
