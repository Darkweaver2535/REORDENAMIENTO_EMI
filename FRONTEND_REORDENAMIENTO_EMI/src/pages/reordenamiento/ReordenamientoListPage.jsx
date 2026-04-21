// src/pages/reordenamiento/ReordenamientoListPage.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeftRight, CheckCircle, PlayCircle, LoaderCircle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../store/AuthContext";
import {
	fetchReordenamientos,
	autorizarReordenamiento,
	ejecutarReordenamiento,
} from "../../api/reordenamientoApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import Badge from "../../components/ui/Badge";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => {
	if (!d) return [];
	const p = d?.data ?? d;
	if (Array.isArray(p)) return p;
	return p?.results ?? p?.data ?? [];
};

const getId      = (r) => r?.id ?? r?.uuid;
const getEstado  = (r) => String(r?.estado ?? "").toLowerCase();
const getEquipo  = (r) => r?.equipo_nombre ?? r?.equipo?.nombre ?? r?.nombre_equipo ?? "—";
const getOrigen  = (r) => r?.laboratorio_origen_nombre ?? r?.laboratorio_origen?.nombre ?? "—";
const getDestino = (r) => r?.laboratorio_destino_nombre ?? r?.laboratorio_destino?.nombre ?? "—";
const getCantidad = (r) => r?.cantidad_trasladada ?? r?.cantidad ?? "—";
const getResolucion = (r) => r?.resolucion_numero ?? r?.numero_resolucion ?? "—";
const getFecha = (r) => {
	const d = r?.fecha_creacion ?? r?.created_at ?? r?.fecha;
	if (!d) return "—";
	return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
};

/* ── Botón de acción por estado ──────────────────────────────── */
function ActionButton({ reordenamiento, onAutorizar, onEjecutar, isPending, pendingId }) {
	const { hasRole } = useAuth();
	const estado = getEstado(reordenamiento);
	const id     = getId(reordenamiento);
	const loading = isPending && pendingId === id;

	if (estado === "pendiente" && hasRole(ROLES.ADMIN, ROLES.DECANO)) {
		return (
			<button
				onClick={() => onAutorizar(id)}
				disabled={loading}
				style={{
					display: "inline-flex", alignItems: "center", gap: "6px",
					padding: "7px 14px", borderRadius: "8px",
					backgroundColor: "#002B5E", color: "#fff",
					fontSize: "13px", fontWeight: 700, border: "none",
					cursor: loading ? "not-allowed" : "pointer",
					opacity: loading ? 0.6 : 1,
					boxShadow: "0 2px 4px rgba(0,43,94,0.25)",
					whiteSpace: "nowrap",
				}}
			>
				{loading
					? <LoaderCircle size={13} className="animate-spin" />
					: <CheckCircle size={13} />
				}
				Autorizar
			</button>
		);
	}

	if (estado === "autorizado" && hasRole(ROLES.ADMIN, ROLES.ENCARGADO_ACTIVOS)) {
		return (
			<button
				onClick={() => onEjecutar(id)}
				disabled={loading}
				style={{
					display: "inline-flex", alignItems: "center", gap: "6px",
					padding: "7px 14px", borderRadius: "8px",
					backgroundColor: "#065f46", color: "#fff",
					fontSize: "13px", fontWeight: 700, border: "none",
					cursor: loading ? "not-allowed" : "pointer",
					opacity: loading ? 0.6 : 1,
					boxShadow: "0 2px 4px rgba(6,95,70,0.25)",
					whiteSpace: "nowrap",
				}}
			>
				{loading
					? <LoaderCircle size={13} className="animate-spin" />
					: <PlayCircle size={13} />
				}
				Ejecutar
			</button>
		);
	}

	return <span style={{ fontSize: "13px", color: "#9ca3af" }}>—</span>;
}

/* ── Componente principal ────────────────────────────────────── */
export default function ReordenamientoListPage() {
	const navigate = useNavigate();
	const { hasRole } = useAuth();
	const queryClient = useQueryClient();

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.DECANO, ROLES.ENCARGADO_ACTIVOS)) {
		return <Navigate to="/dashboard" replace />;
	}

	/* ── Query ────────────────────────────────────────────────── */
	const { data, isLoading, isError } = useQuery({
		queryKey: ["reordenamientos"],
		queryFn: () => fetchReordenamientos(),
		staleTime: 60 * 1000,
	});

	const reordenamientos = useMemo(() => normalize(data), [data]);

	/* ── Mutations ────────────────────────────────────────────── */
	const autorizarMutation = useMutation({
		mutationFn: (id) => autorizarReordenamiento(id),
		onSuccess: () => {
			toast.success("Reordenamiento autorizado correctamente");
			queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
		},
		onError: (err) => {
			const msg = err?.response?.data?.detail ?? "No se pudo autorizar el reordenamiento";
			toast.error(msg);
		},
	});

	const ejecutarMutation = useMutation({
		mutationFn: (id) => ejecutarReordenamiento(id),
		onSuccess: () => {
			toast.success("Traslado ejecutado correctamente");
			queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
		},
		onError: (err) => {
			const msg = err?.response?.data?.detail ?? "No se pudo ejecutar el traslado";
			toast.error(msg);
		},
	});

	const pendingId =
		autorizarMutation.variables ?? ejecutarMutation.variables ?? null;
	const isPending = autorizarMutation.isPending || ejecutarMutation.isPending;

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Reordenamientos"
			description="Historial de traslados de equipos entre laboratorios y sedes."
			actions={
				hasRole(ROLES.ADMIN, ROLES.JEFE) ? (
					<button
						onClick={() => navigate("/reordenamientos/nuevo")}
						style={{
							display: "inline-flex", alignItems: "center", gap: "8px",
							height: "44px", padding: "0 20px", borderRadius: "10px",
							backgroundColor: "#002B5E", color: "#fff",
							fontSize: "15px", fontWeight: 700, border: "none",
							cursor: "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)",
						}}
					>
						<Plus size={18} />
						Nuevo traslado
					</button>
				) : null
			}
		>
			{/* Error */}
			{isError && (
				<div style={{
					display: "flex", alignItems: "center", gap: "12px",
					padding: "16px 20px", borderRadius: "12px",
					backgroundColor: "#fef2f2", border: "1px solid #fecaca",
					marginBottom: "24px",
				}}>
					<AlertCircle size={20} color="#ef4444" />
					<p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>
						No se pudieron cargar los reordenamientos.
					</p>
				</div>
			)}

			{/* Tabla */}
			<div style={{
				backgroundColor: "#fff", border: "1px solid #e5e7eb",
				borderRadius: "14px", overflow: "hidden",
				boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
			}}>
				<div style={{ overflowX: "auto" }}>
					<table style={{ minWidth: "900px", borderCollapse: "collapse", width: "100%" }}>
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								{["Fecha", "Equipo", "Origen", "Destino", "Cantidad", "Estado", "Resolución", "Acción"].map((h) => (
									<th
										key={h}
										style={{ padding: "13px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{/* Skeleton */}
							{isLoading && [1, 2, 3, 4].map((i) => (
								<tr key={i}>
									{[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
										<td key={j} style={{ padding: "16px 20px" }}>
											<div style={{ height: "14px", borderRadius: "6px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
										</td>
									))}
								</tr>
							))}

							{/* Empty */}
							{!isLoading && reordenamientos.length === 0 && (
								<tr>
									<td colSpan={8} style={{ padding: "56px 24px", textAlign: "center" }}>
										<ArrowLeftRight size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
										<p style={{ fontSize: "17px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
											Sin reordenamientos registrados
										</p>
										<p style={{ fontSize: "15px", color: "#9ca3af" }}>Crea el primer traslado con el botón superior.</p>
									</td>
								</tr>
							)}

							{/* Filas */}
							{!isLoading && reordenamientos.map((r, idx) => (
								<tr
									key={getId(r) ?? idx}
									style={{ borderBottom: idx < reordenamientos.length - 1 ? "1px solid #f3f4f6" : "none" }}
									className="hover:bg-gray-50"
								>
									<td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>
										{getFecha(r)}
									</td>
									<td style={{ padding: "14px 20px" }}>
										<p style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{getEquipo(r)}</p>
									</td>
									<td style={{ padding: "14px 20px", fontSize: "14px", color: "#374151", fontWeight: 500 }}>
										{getOrigen(r)}
									</td>
									<td style={{ padding: "14px 20px", fontSize: "14px", color: "#374151", fontWeight: 500 }}>
										{getDestino(r)}
									</td>
									<td style={{ padding: "14px 20px" }}>
										<span style={{
											display: "inline-flex", alignItems: "center", justifyContent: "center",
											minWidth: "36px", height: "28px", padding: "0 10px", borderRadius: "6px",
											backgroundColor: "#f3f4f6", fontSize: "14px", fontWeight: 700, color: "#374151",
										}}>
											{getCantidad(r)}
										</span>
									</td>
									<td style={{ padding: "14px 20px" }}>
										<Badge estado={getEstado(r)} />
									</td>
									<td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "#6b7280", fontFamily: "monospace" }}>
										{getResolucion(r)}
									</td>
									<td style={{ padding: "14px 20px" }}>
										<ActionButton
											reordenamiento={r}
											onAutorizar={(id) => autorizarMutation.mutate(id)}
											onEjecutar={(id) => ejecutarMutation.mutate(id)}
											isPending={isPending}
											pendingId={pendingId}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Footer count */}
				{!isLoading && reordenamientos.length > 0 && (
					<div style={{ padding: "12px 20px", backgroundColor: "#f9fafb", borderTop: "1px solid #f3f4f6" }}>
						<p style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
							{reordenamientos.length} traslado{reordenamientos.length === 1 ? "" : "s"} en total
						</p>
					</div>
				)}
			</div>
		</PageWrapper>
	);
}
