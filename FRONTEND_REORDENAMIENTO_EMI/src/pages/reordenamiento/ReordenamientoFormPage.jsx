// src/pages/reordenamiento/ReordenamientoFormPage.jsx
// Wizard de 3 pasos para crear un reordenamiento
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
	ArrowLeft, ArrowRight, ArrowRightLeft,
	Warehouse, Package, FileText, Check, LoaderCircle, AlertCircle,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { fetchLaboratorios, fetchEquipos } from "../../api/laboratoriosApi";
import { createReordenamiento } from "../../api/reordenamientoApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize    = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const getId        = (x) => x?.id ?? x?.uuid;
const getLabName   = (l) => l?.nombre ?? l?.nombre_laboratorio ?? l?.descripcion ?? "Laboratorio";
const getUnidadAcademica = (l) => l?.sede_nombre ?? l?.unidad_academica_nombre ?? l?.sede ?? "";
const formatLab    = (l) => l ? `${getLabName(l)}${getUnidadAcademica(l) ? " — " + getUnidadAcademica(l) : ""}` : "";
const getEquipName = (e) => e?.nombre ?? e?.nombre_equipo ?? e?.descripcion ?? "Equipo";
const getEquipCode = (e) => e?.codigo_activo ?? e?.codigo ?? "";
const getDisponibles = (e) => Number(e?.cantidad_disponible ?? e?.disponible ?? e?.cantidad_total ?? e?.cantidad ?? 0);

/* ── Schemas Zod por paso ────────────────────────────────────── */
const schemaStep1 = z.object({
	laboratorio_origen_id: z.coerce.number().positive("Selecciona un laboratorio de origen"),
	equipo_id:             z.coerce.number().positive("Selecciona un equipo"),
	cantidad_trasladada:   z.coerce.number().min(1, "Mínimo 1 unidad"),
});

const schemaStep2 = z.object({
	laboratorio_destino_id: z.coerce.number().positive("Selecciona un laboratorio de destino"),
});

const schemaStep3 = z.object({
	resolucion_numero: z.string().min(1, "El número de resolución es obligatorio").trim(),
	motivo:            z.string().optional().default(""),
});

/* ── Sub-componentes ─────────────────────────────────────────── */
function StepIndicator({ current, steps }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "36px" }}>
			{steps.map((step, i) => {
				const done    = i < current;
				const active  = i === current;
				const last    = i === steps.length - 1;
				return (
					<div key={i} style={{ display: "flex", alignItems: "center", flex: last ? undefined : 1 }}>
						{/* Circle */}
						<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
							<div style={{
								width: "40px", height: "40px", borderRadius: "50%",
								display: "flex", alignItems: "center", justifyContent: "center",
								backgroundColor: done ? "#16a34a" : active ? "#002B5E" : "#e5e7eb",
								color: done || active ? "#fff" : "#9ca3af",
								fontSize: "15px", fontWeight: 800,
								transition: "all 200ms ease",
								flexShrink: 0,
							}}>
								{done ? <Check size={18} /> : i + 1}
							</div>
							<span style={{
								fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap",
								color: active ? "#002B5E" : done ? "#15803d" : "#9ca3af",
							}}>
								{step}
							</span>
						</div>
						{/* Connector */}
						{!last && (
							<div style={{
								flex: 1, height: "2px", margin: "0 8px", marginBottom: "18px",
								backgroundColor: done ? "#16a34a" : "#e5e7eb",
								transition: "background-color 200ms ease",
							}} />
						)}
					</div>
				);
			})}
		</div>
	);
}

function FieldLabel({ children, required, htmlFor }) {
	return (
		<label htmlFor={htmlFor} style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
			{children}{required && <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>}
		</label>
	);
}

function FieldError({ message }) {
	if (!message) return null;
	return <p style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>{message}</p>;
}

function StyledSelect({ id, children, error, ...props }) {
	return (
		<select
			id={id}
			style={{
				width: "100%", height: "48px", borderRadius: "8px",
				border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
				backgroundColor: "#fff", paddingLeft: "14px", paddingRight: "40px",
				fontSize: "15px", fontWeight: 500, color: "#111827",
				outline: "none", appearance: "none", cursor: "pointer",
			}}
			{...props}
		>
			{children}
		</select>
	);
}

function StyledInput({ id, error, ...props }) {
	return (
		<input
			id={id}
			style={{
				width: "100%", height: "48px", borderRadius: "8px",
				border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
				backgroundColor: "#fff", paddingLeft: "14px", paddingRight: "14px",
				fontSize: "16px", fontWeight: 500, color: "#111827", outline: "none",
			}}
			{...props}
		/>
	);
}

function SectionCard({ icon: Icon, title, children }) {
	return (
		<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
			<div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "18px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
				<div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
					<Icon size={18} color="#002B5E" />
				</div>
				<h2 style={{ fontSize: "16px", fontWeight: 700, color: "#374151" }}>{title}</h2>
			</div>
			<div style={{ padding: "24px" }}>{children}</div>
		</div>
	);
}

/* ── Componente principal ────────────────────────────────────── */
export default function ReordenamientoFormPage() {
	const navigate   = useNavigate();
	const location   = useLocation();
	const { hasRole } = useAuth();
	const queryClient = useQueryClient();
	const [step, setStep]     = useState(0);
	// Datos acumulados entre pasos
	const [formData, setFormData] = useState({
		laboratorio_origen_id: "",
		equipo_id: "",
		cantidad_trasladada: "",
		laboratorio_destino_id: "",
		resolucion_numero: "",
		motivo: "",
		// Pre-fill desde propuesta de ComparativaSedesPage
		...(location.state?.propuesta ?? {}),
	});

	if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) {
		return <Navigate to="/reordenamientos" replace />;
	}

	/* ── Forms por paso ───────────────────────────────────────── */
	const form1 = useForm({ resolver: zodResolver(schemaStep1), defaultValues: { laboratorio_origen_id: formData.laboratorio_origen_id, equipo_id: formData.equipo_id, cantidad_trasladada: formData.cantidad_trasladada } });
	const form2 = useForm({ resolver: zodResolver(schemaStep2), defaultValues: { laboratorio_destino_id: formData.laboratorio_destino_id } });
	const form3 = useForm({ resolver: zodResolver(schemaStep3), defaultValues: { resolucion_numero: formData.resolucion_numero, motivo: formData.motivo } });

	/* ── Watch campos para info contextual ───────────────────── */
	const watchedOrigenId   = form1.watch("laboratorio_origen_id");
	const watchedEquipoId   = form1.watch("equipo_id");
	const watchedCantidad   = form1.watch("cantidad_trasladada");
	const watchedDestinoId  = form2.watch("laboratorio_destino_id");
	const watchedResolucion = form3.watch("resolucion_numero");

	/* ── Queries ──────────────────────────────────────────────── */
	const { data: labsData, isLoading: loadingLabs } = useQuery({
		queryKey: ["laboratorios"],
		queryFn: fetchLaboratorios,
		staleTime: 5 * 60 * 1000,
	});

	const { data: equiposData, isLoading: loadingEquipos } = useQuery({
		queryKey: ["equipos-lab", watchedOrigenId],
		queryFn: () => fetchEquipos({ laboratorio_id: watchedOrigenId }),
		enabled: Boolean(watchedOrigenId),
	});

	const laboratorios   = useMemo(() => normalize(labsData),    [labsData]);
	const equipos        = useMemo(() => normalize(equiposData),  [equiposData]);
	const selectedEquipo = useMemo(() => equipos.find((e) => String(getId(e)) === String(watchedEquipoId)), [equipos, watchedEquipoId]);
	const disponibles    = selectedEquipo ? getDisponibles(selectedEquipo) : 0;

	const destinoLabs = useMemo(
		() => laboratorios.filter((l) => String(getId(l)) !== String(watchedOrigenId)),
		[laboratorios, watchedOrigenId]
	);

	/* ── Mutation ─────────────────────────────────────────────── */
	const { mutateAsync, isPending } = useMutation({
		mutationFn: createReordenamiento,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
		},
	});

	/* ── Avanzar pasos ────────────────────────────────────────── */
	const goNext1 = form1.handleSubmit((values) => {
		const cantidad = Number(values.cantidad_trasladada);
		if (disponibles > 0 && cantidad > disponibles) {
			form1.setError("cantidad_trasladada", { message: `Máximo disponible: ${disponibles}` });
			return;
		}
		setFormData((p) => ({ ...p, ...values }));
		setStep(1);
	});

	const goNext2 = form2.handleSubmit((values) => {
		setFormData((p) => ({ ...p, ...values }));
		setStep(2);
	});

	const goSubmit = form3.handleSubmit(async (values) => {
		const payload = { ...formData, ...values };
		try {
			await mutateAsync(payload);
			toast.success("¡Traslado creado correctamente!");
			navigate("/reordenamientos");
		} catch (error) {
			const msg = error?.response?.data?.detail ?? error?.response?.data?.message ?? "Error al crear el reordenamiento";
			toast.error(msg);
		}
	});

	const origenLab  = laboratorios.find((l) => String(getId(l)) === String(watchedOrigenId));
	const destinoLab = destinoLabs.find((l) => String(getId(l)) === String(watchedDestinoId));
	const equipoSelec = equipos.find((e) => String(getId(e)) === String(watchedEquipoId));

	/* ── Helper de nav buttons ────────────────────────────────── */
	const navBtnBase = {
		display: "inline-flex", alignItems: "center", gap: "8px",
		height: "46px", padding: "0 24px", borderRadius: "10px",
		fontSize: "15px", fontWeight: 700, border: "none",
		cursor: "pointer", transition: "all 150ms ease",
	};

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Nuevo reordenamiento"
			description="Completa los pasos para registrar un traslado de equipos entre laboratorios."
			actions={
				<button
					onClick={() => navigate("/reordenamientos")}
					style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}
				>
					<ArrowLeft size={17} />
					Volver
				</button>
			}
		>
			{/* Wizard steps */}
			<StepIndicator current={step} steps={["Origen y Equipo", "Destino", "Documentación"]} />

			<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

				{/* ══ PASO 1: Origen y Equipo ═════════════════════ */}
				{step === 0 && (
					<form onSubmit={goNext1}>
						<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
							<SectionCard icon={Warehouse} title="Laboratorio de Origen">
								<div>
									<FieldLabel htmlFor="lab-origen" required>Laboratorio Origen</FieldLabel>
									{loadingLabs ? (
										<div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
									) : (
										<StyledSelect
											id="lab-origen"
											error={form1.formState.errors.laboratorio_origen_id}
											{...form1.register("laboratorio_origen_id", {
												onChange: () => { form1.setValue("equipo_id", ""); form1.setValue("cantidad_trasladada", ""); },
											})}
										>
											<option value="">Selecciona un laboratorio…</option>
											{laboratorios.map((l) => (
												<option key={getId(l)} value={getId(l)}>{formatLab(l)}</option>
											))}
										</StyledSelect>
									)}
									<FieldError message={form1.formState.errors.laboratorio_origen_id?.message} />
								</div>
							</SectionCard>

							<SectionCard icon={Package} title="Equipo a Trasladar">
								<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>
									<div>
										<FieldLabel htmlFor="equipo" required>Equipo</FieldLabel>
										{loadingEquipos && watchedOrigenId ? (
											<div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
										) : (
											<StyledSelect
												id="equipo"
												disabled={!watchedOrigenId}
												error={form1.formState.errors.equipo_id}
												{...form1.register("equipo_id", {
													onChange: () => form1.setValue("cantidad_trasladada", ""),
												})}
											>
												<option value="">{!watchedOrigenId ? "Primero selecciona origen…" : "Selecciona un equipo…"}</option>
												{equipos.map((e) => (
													<option key={getId(e)} value={getId(e)}>
														{getEquipCode(e) ? `[${getEquipCode(e)}] ` : ""}{getEquipName(e)} — {getDisponibles(e)} disponibles
													</option>
												))}
											</StyledSelect>
										)}
										<FieldError message={form1.formState.errors.equipo_id?.message} />
									</div>

									<div style={{ minWidth: "140px" }}>
										<FieldLabel htmlFor="cantidad" required>Cantidad</FieldLabel>
										<StyledInput
											id="cantidad"
											type="number"
											min={1}
											max={disponibles || undefined}
											placeholder="0"
											disabled={!watchedEquipoId}
											error={form1.formState.errors.cantidad_trasladada}
											{...form1.register("cantidad_trasladada", { valueAsNumber: true })}
										/>
										{equipoSelec && (
											<p style={{ marginTop: "5px", fontSize: "13px", fontWeight: 600, color: disponibles > 0 ? "#15803d" : "#dc2626" }}>
												{disponibles} disponibles
											</p>
										)}
										<FieldError message={form1.formState.errors.cantidad_trasladada?.message} />
									</div>
								</div>
							</SectionCard>

							<div style={{ display: "flex", justifyContent: "flex-end" }}>
								<button type="submit" style={{ ...navBtnBase, backgroundColor: "#002B5E", color: "#fff", boxShadow: "0 4px 6px rgba(0,43,94,0.25)" }}>
									Siguiente
									<ArrowRight size={17} />
								</button>
							</div>
						</div>
					</form>
				)}

				{/* ══ PASO 2: Destino ═════════════════════════════ */}
				{step === 1 && (
					<form onSubmit={goNext2}>
						<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
							{/* Resumen paso 1 */}
							<div style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: "#EFF6FF", border: "1px solid #dbeafe" }}>
								<p style={{ fontSize: "13px", fontWeight: 700, color: "#002B5E", marginBottom: "4px" }}>Resumen del origen:</p>
								<p style={{ fontSize: "15px", fontWeight: 500, color: "#374151" }}>
									{formatLab(origenLab)} · <strong>{getEquipName(equipoSelec)}</strong> · {formData.cantidad_trasladada} unidades
								</p>
							</div>

							<SectionCard icon={ArrowRightLeft} title="Laboratorio de Destino">
								<div>
									<FieldLabel htmlFor="lab-destino" required>Laboratorio Destino</FieldLabel>
									{loadingLabs ? (
										<div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
									) : (
										<StyledSelect
											id="lab-destino"
											error={form2.formState.errors.laboratorio_destino_id}
											{...form2.register("laboratorio_destino_id")}
										>
											<option value="">Selecciona un laboratorio de destino…</option>
											{destinoLabs.map((l) => (
												<option key={getId(l)} value={getId(l)}>{formatLab(l)}</option>
											))}
										</StyledSelect>
									)}
									<FieldError message={form2.formState.errors.laboratorio_destino_id?.message} />
								</div>
							</SectionCard>

							{/* Preview de movimiento */}
							{origenLab && destinoLab && (
								<div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
									<span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", flex: 1, textAlign: "right" }}>{getLabName(origenLab)}</span>
									<div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
										<ArrowRightLeft size={18} color="#15803d" />
										<span style={{ fontSize: "14px", fontWeight: 800, color: "#15803d" }}>{formData.cantidad_trasladada} u.</span>
									</div>
									<span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", flex: 1 }}>{getLabName(destinoLab)}</span>
								</div>
							)}

							<div style={{ display: "flex", justifyContent: "space-between" }}>
								<button type="button" onClick={() => setStep(0)} style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
									<ArrowLeft size={17} />
									Anterior
								</button>
								<button type="submit" style={{ ...navBtnBase, backgroundColor: "#002B5E", color: "#fff", boxShadow: "0 4px 6px rgba(0,43,94,0.25)" }}>
									Siguiente
									<ArrowRight size={17} />
								</button>
							</div>
						</div>
					</form>
				)}

				{/* ══ PASO 3: Documentación ═══════════════════════ */}
				{step === 2 && (
					<form onSubmit={goSubmit}>
						<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
							{/* Resumen completo */}
							<div style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: "#EFF6FF", border: "1px solid #dbeafe" }}>
								<p style={{ fontSize: "13px", fontWeight: 700, color: "#002B5E", marginBottom: "6px" }}>Resumen del traslado:</p>
								<p style={{ fontSize: "15px", color: "#374151", fontWeight: 500, lineHeight: 1.6 }}>
									<strong>{formData.cantidad_trasladada}</strong> unidades de <strong>{getEquipName(equipoSelec)}</strong>
									{" desde "}<strong>{formatLab(origenLab)}</strong>
									{" hacia "}<strong>{formatLab(destinoLab)}</strong>
								</p>
							</div>

							<SectionCard icon={FileText} title="Documentación (Requerida)">
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
									<div>
										<FieldLabel htmlFor="resolucion" required>N.º Resolución</FieldLabel>
										<StyledInput
											id="resolucion"
											type="text"
											placeholder="Ej: RES-2026-042"
											error={form3.formState.errors.resolucion_numero}
											{...form3.register("resolucion_numero")}
										/>
										<FieldError message={form3.formState.errors.resolucion_numero?.message} />
									</div>
									<div>
										<FieldLabel htmlFor="motivo">Motivo (opcional)</FieldLabel>
										<textarea
											id="motivo"
											rows={1}
											placeholder="Motivo del traslado..."
											style={{ width: "100%", borderRadius: "8px", border: "1px solid #d1d5db", padding: "10px 14px", fontSize: "15px", fontWeight: 500, color: "#111827", outline: "none", resize: "vertical" }}
											{...form3.register("motivo")}
										/>
									</div>
								</div>
							</SectionCard>

							{/* Error global */}
							{form3.formState.errors.root && (
								<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
									<AlertCircle size={18} color="#ef4444" />
									<p style={{ fontSize: "14px", fontWeight: 600, color: "#b91c1c" }}>{form3.formState.errors.root.message}</p>
								</div>
							)}

							<div style={{ display: "flex", justifyContent: "space-between" }}>
								<button type="button" onClick={() => setStep(1)} style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
									<ArrowLeft size={17} />
									Anterior
								</button>
								<button
									type="submit"
									disabled={isPending}
									style={{ ...navBtnBase, backgroundColor: "#002B5E", color: "#fff", boxShadow: "0 4px 6px rgba(0,43,94,0.25)", opacity: isPending ? 0.6 : 1, cursor: isPending ? "not-allowed" : "pointer" }}
								>
									{isPending ? (
										<><LoaderCircle size={17} className="animate-spin" />Creando...</>
									) : (
										<><Check size={17} />Crear traslado</>
									)}
								</button>
							</div>
						</div>
					</form>
				)}
			</div>
		</PageWrapper>
	);
}