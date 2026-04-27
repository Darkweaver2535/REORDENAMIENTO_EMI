// src/components/laboratorios/ModalEvaluacionInsitu.jsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X, ClipboardCheck, LoaderCircle, CheckCircle, RotateCcw, Calendar, User } from "lucide-react";
import { updateEvaluacionInsitu } from "../../api/laboratoriosApi";

const getId   = (e) => e?.id ?? e?.uuid;
const getCode = (e) => e?.codigo_activo ?? e?.codigo ?? "—";
const getName = (e) => e?.nombre ?? e?.nombre_equipo ?? "Equipo";

const CONDICIONES = [
	{ value: "bueno",   label: "Bueno",   emoji: "✅", bg: "#f0fdf4", bgActive: "#dcfce7", border: "#86efac", color: "#15803d", dot: "#22c55e" },
	{ value: "regular", label: "Regular", emoji: "⚠️", bg: "#fffbeb", bgActive: "#fef3c7", border: "#fcd34d", color: "#92400e", dot: "#f59e0b" },
	{ value: "malo",    label: "Malo",    emoji: "❌", bg: "#fef2f2", bgActive: "#fee2e2", border: "#fca5a5", color: "#991b1b", dot: "#ef4444" },
];

const formatFecha = (d) => {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function ModalEvaluacionInsitu({ isOpen, onClose, equipo, queryKey }) {
	const queryClient = useQueryClient();

	const yaEvaluado = !!equipo?.evaluado_en;
	const [modoFormulario, setModoFormulario] = useState(false);
	const [condicion, setCondicion] = useState("");
	const [observaciones, setObservaciones] = useState("");

	// Reset state when equipo changes
	useEffect(() => {
		if (isOpen && equipo) {
			setModoFormulario(!yaEvaluado);
			setCondicion(equipo?.estatus_general || "");
			setObservaciones(equipo?.observaciones || "");
		}
	}, [isOpen, equipo, yaEvaluado]);

	const mutation = useMutation({
		mutationFn: (payload) => updateEvaluacionInsitu(getId(equipo), payload),
		onSuccess: async () => {
			toast.success("Evaluación registrada correctamente");
			const key = queryKey ?? ["equipos"];
			await queryClient.invalidateQueries({ queryKey: key });
			onClose();
		},
		onError: (error) => {
			const detail = error?.response?.data?.detail ?? error?.response?.data?.condicion?.[0];
			toast.error(detail ?? "No se pudo guardar la evaluación.");
		},
	});

	const handleSubmit = async () => {
		if (!condicion) { toast.error("Selecciona la condición del equipo"); return; }
		await mutation.mutateAsync({
			condicion,
			observaciones: observaciones.trim(),
		});
	};

	if (!isOpen || !equipo) return null;

	const isPending = mutation.isPending;
	const condCfg = CONDICIONES.find(c => c.value === equipo?.estatus_general);

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			{/* Backdrop */}
			<div onClick={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }} />

			{/* Panel */}
			<div style={{ position: "relative", width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", overflow: "hidden" }}>

				{/* Header */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
							<ClipboardCheck size={20} color="#002B5E" />
						</div>
						<div>
							<h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.2, margin: 0 }}>Evaluación In-Situ</h2>
							<p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, marginTop: 3, margin: 0 }}>
								<span style={{ fontFamily: "monospace", color: "#6b7280" }}>{getCode(equipo)}</span>
								{" · "}{getName(equipo)}
							</p>
						</div>
					</div>
					<button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", backgroundColor: "transparent" }} className="hover:bg-gray-100">
						<X size={20} />
					</button>
				</div>

				{/* Content */}
				<div style={{ padding: 24 }}>

					{/* ══ MODO DETALLE (ya evaluado) ══ */}
					{yaEvaluado && !modoFormulario && (
						<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
							<p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Resultado de la evaluación</p>

							{/* Condición card */}
							{condCfg && (
								<div style={{
									padding: "20px 24px", borderRadius: 14,
									backgroundColor: condCfg.bg, border: `2px solid ${condCfg.border}`,
									display: "flex", alignItems: "center", gap: 14,
								}}>
									<span style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: condCfg.dot, flexShrink: 0 }} />
									<span style={{ fontSize: 20, fontWeight: 800, color: condCfg.color, textTransform: "uppercase" }}>
										{condCfg.label}
									</span>
								</div>
							)}

							{/* Fecha */}
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<Calendar size={15} color="#9ca3af" />
								<div>
									<p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, margin: 0 }}>Fecha de evaluación</p>
									<p style={{ fontSize: 14, color: "#111827", fontWeight: 600, margin: 0 }}>{formatFecha(equipo.evaluado_en)}</p>
								</div>
							</div>

							{/* Evaluador */}
							{equipo.evaluado_por_nombre && (
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<User size={15} color="#9ca3af" />
									<div>
										<p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, margin: 0 }}>Evaluado por</p>
										<p style={{ fontSize: 14, color: "#111827", fontWeight: 600, margin: 0 }}>{equipo.evaluado_por_nombre}</p>
									</div>
								</div>
							)}

							{/* Observaciones */}
							<div>
								<p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>Observaciones</p>
								<div style={{ padding: "12px 16px", borderRadius: 10, backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", minHeight: 48 }}>
									<p style={{ fontSize: 14, color: equipo.observaciones ? "#374151" : "#9ca3af", fontStyle: equipo.observaciones ? "normal" : "italic", margin: 0, lineHeight: 1.5 }}>
										{equipo.observaciones || "Sin observaciones"}
									</p>
								</div>
							</div>

							{/* Botones */}
							<div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
								<button onClick={() => setModoFormulario(true)} style={{
									display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 10,
									border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
								}} className="hover:bg-gray-50">
									<RotateCcw size={15} /> Re-evaluar
								</button>
								<button onClick={onClose} style={{
									height: 44, padding: "0 24px", borderRadius: 10,
									backgroundColor: "#002B5E", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
									boxShadow: "0 2px 8px rgba(0,43,94,0.3)",
								}}>
									Cerrar
								</button>
							</div>
						</div>
					)}

					{/* ══ MODO FORMULARIO ══ */}
					{(!yaEvaluado || modoFormulario) && (
						<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
							<p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
								{yaEvaluado ? "Re-evaluación" : "Nueva evaluación"}
							</p>

							{/* Condición cards */}
							<div>
								<p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
									Condición del equipo <span style={{ color: "#ef4444" }}>*</span>
								</p>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
									{CONDICIONES.map(op => {
										const selected = condicion === op.value;
										return (
											<button
												key={op.value}
												type="button"
												onClick={() => setCondicion(op.value)}
												style={{
													display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
													padding: "18px 12px", borderRadius: 12,
													border: `2px solid ${selected ? op.border : "#e5e7eb"}`,
													backgroundColor: selected ? op.bgActive : "#fff",
													cursor: "pointer", transition: "all 150ms ease",
													transform: selected ? "scale(1.03)" : "scale(1)",
													boxShadow: selected ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
												}}
											>
												<span style={{ fontSize: 24 }}>{op.emoji}</span>
												<span style={{ fontSize: 14, fontWeight: 700, color: selected ? op.color : "#6b7280" }}>{op.label}</span>
											</button>
										);
									})}
								</div>
							</div>

							{/* Observaciones */}
							<div>
								<label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
									Observaciones <span style={{ color: "#9ca3af", fontWeight: 500 }}>(opcional)</span>
								</label>
								<textarea
									rows={3}
									placeholder="Describe el estado físico, daños visibles, accesorios faltantes..."
									value={observaciones}
									onChange={e => setObservaciones(e.target.value)}
									maxLength={500}
									style={{
										width: "100%", borderRadius: 10, border: "1px solid #d1d5db", backgroundColor: "#fff",
										padding: "12px 14px", fontSize: 14, fontWeight: 500, color: "#111827", outline: "none",
										resize: "vertical", lineHeight: 1.5,
									}}
								/>
								<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
									{observaciones.length}/500
								</p>
							</div>

							{/* Botones */}
							<div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
								<button onClick={() => { if (yaEvaluado) setModoFormulario(false); else onClose(); }} style={{
									height: 44, padding: "0 20px", borderRadius: 10,
									border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer",
								}}>
									Cancelar
								</button>
								<button
									onClick={handleSubmit}
									disabled={!condicion || isPending}
									style={{
										display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 24px", borderRadius: 10,
										backgroundColor: !condicion || isPending ? "#9ca3af" : "#002B5E",
										color: "#fff", fontSize: 15, fontWeight: 700, border: "none",
										cursor: !condicion || isPending ? "not-allowed" : "pointer",
										boxShadow: !condicion ? "none" : "0 2px 8px rgba(0,43,94,0.3)",
										transition: "all 200ms ease",
									}}
								>
									{isPending ? <><LoaderCircle size={17} className="animate-spin" />Guardando...</> : <><CheckCircle size={17} />Guardar evaluación</>}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
