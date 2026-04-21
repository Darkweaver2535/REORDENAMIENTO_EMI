// src/components/laboratorios/ModalEvaluacionInsitu.jsx
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X, ClipboardCheck, LoaderCircle, CheckCircle, AlertCircle } from "lucide-react";
import { updateEvaluacionInsitu } from "../../api/laboratoriosApi";

/* ── Helpers ─────────────────────────────────────────────────── */
const safe    = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const getId   = (e) => e?.id ?? e?.uuid ?? e?.codigo_activo;
const getCode = (e) => e?.codigo_activo ?? e?.codigo ?? e?.serial ?? "—";
const getName = (e) => e?.nombre ?? e?.nombre_equipo ?? e?.descripcion ?? "Equipo";

/* ── Schema Zod ─────────────────────────────────────────────── */
// La validación de coincidencia de totales la hacemos fuera del schema
// con watch() para poder mostrar feedback en tiempo real.
const schema = z.object({
	cantidad_buena:   z.number({ invalid_type_error: "Requerido" }).int().min(0, "Mínimo 0"),
	cantidad_regular: z.number({ invalid_type_error: "Requerido" }).int().min(0, "Mínimo 0"),
	cantidad_mala:    z.number({ invalid_type_error: "Requerido" }).int().min(0, "Mínimo 0"),
	ubicacion_sala:   z.string().max(200).optional().default(""),
	observaciones:    z.string().max(1000).optional().default(""),
});

/* ── Sub-componentes de UI ──────────────────────────────────── */
function NumericField({ id, label, emoji, register, error }) {
	return (
		<div>
			<label
				htmlFor={id}
				style={{
					display: "block", fontSize: "13px", fontWeight: 700,
					color: "#374151", marginBottom: "7px",
				}}
			>
				{emoji} {label}
			</label>
			<input
				id={id}
				type="number"
				min={0}
				step={1}
				style={{
					width: "100%", height: "46px", borderRadius: "8px",
					border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
					backgroundColor: error ? "#fff5f5" : "#fff",
					padding: "0 14px", fontSize: "18px", fontWeight: 700,
					color: "#111827", outline: "none", textAlign: "center",
					transition: "border-color 150ms ease",
				}}
				{...register}
			/>
			{error && (
				<p style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626", marginTop: "4px" }}>
					{error.message}
				</p>
			)}
		</div>
	);
}

/* ── Componente principal ───────────────────────────────────── */
export default function ModalEvaluacionInsitu({ isOpen, onClose, equipo, queryKey }) {
	const queryClient = useQueryClient();
	const totalRegistrado = safe(equipo?.cantidad_total ?? equipo?.total ?? equipo?.cantidad);

	/* ── Form ─────────────────────────────────────────────────── */
	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors, isSubmitting },
	} = useForm({
		resolver: zodResolver(schema),
		defaultValues: {
			cantidad_buena:   safe(equipo?.evaluacion?.buenas   ?? equipo?.buenas   ?? equipo?.cantidad_buena),
			cantidad_regular: safe(equipo?.evaluacion?.regulares ?? equipo?.regulares ?? equipo?.cantidad_regular),
			cantidad_mala:    safe(equipo?.evaluacion?.malas    ?? equipo?.malas    ?? equipo?.cantidad_mala),
			ubicacion_sala:  equipo?.evaluacion?.ubicacion_exacta ?? equipo?.ubicacion_sala ?? equipo?.ubicacion_exacta ?? "",
			observaciones:   equipo?.evaluacion?.observaciones   ?? equipo?.observaciones  ?? "",
		},
	});

	// Resetear el form cuando cambia el equipo
	useEffect(() => {
		if (isOpen && equipo) {
			reset({
				cantidad_buena:   safe(equipo?.evaluacion?.buenas   ?? equipo?.buenas   ?? equipo?.cantidad_buena),
				cantidad_regular: safe(equipo?.evaluacion?.regulares ?? equipo?.regulares ?? equipo?.cantidad_regular),
				cantidad_mala:    safe(equipo?.evaluacion?.malas    ?? equipo?.malas    ?? equipo?.cantidad_mala),
				ubicacion_sala:  equipo?.evaluacion?.ubicacion_exacta ?? equipo?.ubicacion_sala ?? equipo?.ubicacion_exacta ?? "",
				observaciones:   equipo?.evaluacion?.observaciones   ?? equipo?.observaciones  ?? "",
			});
		}
	}, [isOpen, equipo, reset]);

	/* ── watch() para totales en tiempo real ─────────────────── */
	const buena   = safe(useWatch({ control, name: "cantidad_buena" }));
	const regular = safe(useWatch({ control, name: "cantidad_regular" }));
	const mala    = safe(useWatch({ control, name: "cantidad_mala" }));

	const totalEvaluado  = buena + regular + mala;
	const totalesCoinciden = totalRegistrado === 0 || totalEvaluado === totalRegistrado;
	const hayDiscrepancia  = totalRegistrado > 0 && !totalesCoinciden;

	/* ── Mutation ─────────────────────────────────────────────── */
	const mutation = useMutation({
		mutationFn: (payload) => updateEvaluacionInsitu(getId(equipo), payload),
		onSuccess: async () => {
			toast.success("Evaluación registrada correctamente");
			// Invalidar la query de equipos para refrescar la tabla
			const key = queryKey ?? ["equipos"];
			await queryClient.invalidateQueries({ queryKey: key });
			onClose();
		},
		onError: (error) => {
			const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
			toast.error(detail ?? "No se pudo guardar la evaluación. Intenta de nuevo.");
		},
	});

	/* ── Submit ───────────────────────────────────────────────── */
	const onSubmit = async (values) => {
		if (hayDiscrepancia) return; // Guard extra por si acaso
		await mutation.mutateAsync({
			cantidad_buena:   values.cantidad_buena,
			cantidad_regular: values.cantidad_regular,
			cantidad_mala:    values.cantidad_mala,
			ubicacion_sala:   values.ubicacion_sala,
			observaciones:    values.observaciones,
		});
	};

	/* ── No renderizar si cerrado ─────────────────────────────── */
	if (!isOpen || !equipo) return null;

	return (
		<div style={{
			position: "fixed", inset: 0, zIndex: 50,
			display: "flex", alignItems: "center", justifyContent: "center",
			padding: "16px",
		}}>
			{/* Backdrop */}
			<div
				onClick={onClose}
				style={{
					position: "absolute", inset: 0,
					backgroundColor: "rgba(0,0,0,0.5)",
					backdropFilter: "blur(3px)",
				}}
			/>

			{/* Panel ─────────────────────────── */}
			<div style={{
				position: "relative", width: "100%", maxWidth: "500px",
				backgroundColor: "#ffffff", borderRadius: "18px",
				boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
				overflow: "hidden",
			}}>

				{/* Header */}
				<div style={{
					display: "flex", alignItems: "center", justifyContent: "space-between",
					padding: "20px 24px",
					borderBottom: "1px solid #f3f4f6",
					backgroundColor: "#fafafa",
				}}>
					<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
						<div style={{
							width: "40px", height: "40px", borderRadius: "12px",
							backgroundColor: "#EFF6FF",
							display: "flex", alignItems: "center", justifyContent: "center",
						}}>
							<ClipboardCheck size={20} color="#002B5E" />
						</div>
						<div>
							<h2 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
								Evaluación in-situ
							</h2>
							<p style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500, marginTop: "3px" }}>
								<span style={{ fontFamily: "monospace", color: "#6b7280" }}>{getCode(equipo)}</span>
								{" · "}{getName(equipo)}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							width: "36px", height: "36px", borderRadius: "8px",
							border: "none", cursor: "pointer",
							display: "flex", alignItems: "center", justifyContent: "center",
							color: "#9ca3af",
						}}
						className="hover:bg-gray-100"
						aria-label="Cerrar modal"
					>
						<X size={20} />
					</button>
				</div>

				{/* Formulario */}
				<form onSubmit={handleSubmit(onSubmit)} style={{ padding: "24px" }}>

					{/* ── Campos numéricos ─────────────────────── */}
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "20px" }}>
						<NumericField
							id="cantidad_buena"
							label="Buenas"
							emoji="✅"
							register={register("cantidad_buena", { valueAsNumber: true })}
							error={errors.cantidad_buena}
						/>
						<NumericField
							id="cantidad_regular"
							label="Regulares"
							emoji="⚠️"
							register={register("cantidad_regular", { valueAsNumber: true })}
							error={errors.cantidad_regular}
						/>
						<NumericField
							id="cantidad_mala"
							label="Malas"
							emoji="❌"
							register={register("cantidad_mala", { valueAsNumber: true })}
							error={errors.cantidad_mala}
						/>
					</div>

					{/* ── Panel de totales en tiempo real ─────── */}
					<div style={{
						display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
						marginBottom: "20px",
					}}>
						{/* Total evaluado */}
						<div style={{
							padding: "14px 18px", borderRadius: "10px",
							backgroundColor: hayDiscrepancia ? "#fef2f2" : totalesCoinciden && totalRegistrado > 0 ? "#f0fdf4" : "#f9fafb",
							border: "1px solid " + (hayDiscrepancia ? "#fecaca" : totalesCoinciden && totalRegistrado > 0 ? "#bbf7d0" : "#e5e7eb"),
							transition: "all 200ms ease",
						}}>
							<p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af", marginBottom: "6px" }}>
								Total evaluado
							</p>
							<p style={{
								fontSize: "28px", fontWeight: 800, lineHeight: 1,
								color: hayDiscrepancia ? "#dc2626" : totalesCoinciden && totalRegistrado > 0 ? "#15803d" : "#111827",
							}}>
								{totalEvaluado}
							</p>
						</div>

						{/* Total registrado */}
						<div style={{
							padding: "14px 18px", borderRadius: "10px",
							backgroundColor: "#f9fafb", border: "1px solid #e5e7eb",
						}}>
							<p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af", marginBottom: "6px" }}>
								Total registrado
							</p>
							<p style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1, color: "#374151" }}>
								{totalRegistrado || "—"}
							</p>
						</div>
					</div>

					{/* ── Mensaje de error de totales ──────────── */}
					{hayDiscrepancia && (
						<div style={{
							display: "flex", alignItems: "flex-start", gap: "10px",
							padding: "12px 16px", borderRadius: "10px",
							backgroundColor: "#fef2f2", border: "1px solid #fecaca",
							marginBottom: "20px",
						}}>
							<AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />
							<div>
								<p style={{ fontSize: "14px", fontWeight: 700, color: "#b91c1c" }}>
									El total no coincide con el registrado
								</p>
								<p style={{ fontSize: "13px", fontWeight: 500, color: "#dc2626", marginTop: "3px" }}>
									Estás evaluando {totalEvaluado} de {totalRegistrado} unidades.{" "}
									{totalEvaluado < totalRegistrado
										? `Faltan ${totalRegistrado - totalEvaluado} unidades por clasificar.`
										: `Hay ${totalEvaluado - totalRegistrado} unidades de más.`}
								</p>
							</div>
						</div>
					)}

					{/* ── Mensaje de éxito de totales ──────────── */}
					{totalesCoinciden && totalRegistrado > 0 && (
						<div style={{
							display: "flex", alignItems: "center", gap: "10px",
							padding: "12px 16px", borderRadius: "10px",
							backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
							marginBottom: "20px",
						}}>
							<CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0 }} />
							<p style={{ fontSize: "14px", fontWeight: 700, color: "#15803d" }}>
								Los totales coinciden correctamente.
							</p>
						</div>
					)}

					{/* ── Campos de texto ──────────────────────── */}
					<div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
						{/* Ubicación sala */}
						<div>
							<label
								htmlFor="ubicacion_sala"
								style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "7px" }}
							>
								Ubicación en sala
							</label>
							<input
								id="ubicacion_sala"
								type="text"
								placeholder="Ej: Estante 2, fila 3, posición A4"
								style={{
									width: "100%", height: "44px", borderRadius: "8px",
									border: "1px solid #d1d5db", backgroundColor: "#fff",
									padding: "0 14px", fontSize: "15px", fontWeight: 500,
									color: "#111827", outline: "none",
								}}
								{...register("ubicacion_sala")}
							/>
						</div>

						{/* Observaciones */}
						<div>
							<label
								htmlFor="observaciones"
								style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "7px" }}
							>
								Observaciones
							</label>
							<textarea
								id="observaciones"
								rows={3}
								placeholder="Estado general, fallas detectadas, necesidad de mantenimiento..."
								style={{
									width: "100%", borderRadius: "8px",
									border: "1px solid #d1d5db", backgroundColor: "#fff",
									padding: "10px 14px", fontSize: "15px", fontWeight: 500,
									color: "#111827", outline: "none", resize: "vertical",
									lineHeight: 1.5,
								}}
								{...register("observaciones")}
							/>
						</div>
					</div>

					{/* ── Botones ──────────────────────────────── */}
					<div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
						<button
							type="button"
							onClick={onClose}
							style={{
								height: "46px", padding: "0 22px", borderRadius: "10px",
								border: "1px solid #e5e7eb", backgroundColor: "#fff",
								fontWeight: 600, fontSize: "14px", cursor: "pointer", color: "#374151",
							}}
						>
							Cancelar
						</button>

						<button
							type="submit"
							disabled={isSubmitting || mutation.isPending || hayDiscrepancia}
							title={hayDiscrepancia ? "Corrige el total antes de guardar" : ""}
							style={{
								height: "46px", padding: "0 24px", borderRadius: "10px",
								backgroundColor: hayDiscrepancia ? "#9ca3af" : "#002B5E",
								color: "#fff", fontWeight: 700, fontSize: "15px",
								border: "none",
								cursor: isSubmitting || mutation.isPending || hayDiscrepancia ? "not-allowed" : "pointer",
								opacity: isSubmitting || mutation.isPending ? 0.7 : 1,
								display: "flex", alignItems: "center", gap: "8px",
								boxShadow: hayDiscrepancia ? "none" : "0 2px 8px rgba(0,43,94,0.3)",
								transition: "all 200ms ease",
							}}
						>
							{isSubmitting || mutation.isPending ? (
								<>
									<LoaderCircle size={17} className="animate-spin" />
									Guardando...
								</>
							) : (
								<>
									<CheckCircle size={17} />
									Guardar evaluación
								</>
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
