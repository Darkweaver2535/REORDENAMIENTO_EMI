// src/components/laboratorios/ModalEvaluacionInsitu.jsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
	X, ClipboardCheck, LoaderCircle, CheckCircle,
	RotateCcw, Calendar, User, Minus, Plus,
} from "lucide-react";
import httpClient from "../../api/httpClient";
import { API_ROUTES } from "../../constants/api";

const getId   = (e) => e?.id ?? e?.uuid;
const getCode = (e) => e?.codigo_activo ?? e?.codigo ?? "—";
const getName = (e) => e?.nombre ?? e?.nombre_equipo ?? "Equipo";
const safe    = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const formatFecha = (d) => {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("es-BO", {
		day: "2-digit", month: "long", year: "numeric",
		hour: "2-digit", minute: "2-digit",
	});
};

const CONDICIONES = [
	{ key: "bueno",   label: "Buenas",   emoji: "✅", bar: "#22c55e", text: "#15803d", bg: "#f0fdf4", border: "#86efac" },
	{ key: "regular", label: "Regulares", emoji: "⚠️", bar: "#f59e0b", text: "#92400e", bg: "#fffbeb", border: "#fcd34d" },
	{ key: "malo",    label: "Malas",     emoji: "❌", bar: "#ef4444", text: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
];

/* ── Barra de progreso ────────────────────────────────────── */
function BarraCondicion({ label, emoji, cantidad, total, barColor, textColor, bgColor }) {
	const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0;
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, backgroundColor: bgColor }}>
			<span style={{ fontSize: 16 }}>{emoji}</span>
			<span style={{ fontSize: 13, fontWeight: 700, color: textColor, width: 80 }}>{label}</span>
			<div style={{ flex: 1, height: 8, backgroundColor: "#fff", borderRadius: 4, overflow: "hidden", border: "1px solid #e5e7eb" }}>
				<div style={{ height: "100%", backgroundColor: barColor, width: `${pct}%`, transition: "width 400ms ease", borderRadius: 4 }} />
			</div>
			<span style={{ fontSize: 13, fontWeight: 800, color: textColor, minWidth: 50, textAlign: "right" }}>{cantidad} / {total}</span>
			<span style={{ fontSize: 12, color: "#9ca3af", minWidth: 36, textAlign: "right" }}>{pct}%</span>
		</div>
	);
}

/* ── Counter +/- ──────────────────────────────────────────── */
function CounterCondicion({ label, emoji, value, onChange, bgColor, borderColor, textColor }) {
	return (
		<div style={{
			display: "flex", alignItems: "center", justifyContent: "space-between",
			padding: "12px 16px", borderRadius: 10,
			backgroundColor: bgColor, border: `1.5px solid ${borderColor}`,
		}}>
			<span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: textColor }}>
				<span style={{ fontSize: 18 }}>{emoji}</span> {label}
			</span>
			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				<button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}
					style={{
						width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${borderColor}`,
						backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
						cursor: value === 0 ? "not-allowed" : "pointer", opacity: value === 0 ? 0.4 : 1,
						color: textColor, fontWeight: 800,
					}}>
					<Minus size={16} />
				</button>
				<span style={{ width: 32, textAlign: "center", fontSize: 20, fontWeight: 800, color: textColor }}>{value}</span>
				<button type="button" onClick={() => onChange(value + 1)}
					style={{
						width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${borderColor}`,
						backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
						cursor: "pointer", color: textColor, fontWeight: 800,
					}}>
					<Plus size={16} />
				</button>
			</div>
		</div>
	);
}

/* ── Modal principal ──────────────────────────────────────── */
export default function ModalEvaluacionInsitu({ isOpen, onClose, equipo, queryKey }) {
	const queryClient = useQueryClient();

	const ev = equipo?.ultima_evaluacion;
	const yaEvaluado = !!ev;
	const cantidadTotal = safe(equipo?.cantidad_total);

	const [modo, setModo] = useState("ver");
	const [cantBueno, setCantBueno] = useState(0);
	const [cantRegular, setCantRegular] = useState(0);
	const [cantMalo, setCantMalo] = useState(0);
	const [observaciones, setObservaciones] = useState("");

	useEffect(() => {
		if (isOpen && equipo) {
			if (yaEvaluado) {
				setModo("ver");
			} else {
				setModo("form");
				setCantBueno(safe(equipo?.cantidad_buena));
				setCantRegular(safe(equipo?.cantidad_regular));
				setCantMalo(safe(equipo?.cantidad_mala));
				setObservaciones(equipo?.observaciones || "");
			}
		}
	}, [isOpen, equipo, yaEvaluado]);

	const handleReEvaluar = () => {
		setCantBueno(safe(ev?.cantidad_bueno ?? equipo?.cantidad_buena));
		setCantRegular(safe(ev?.cantidad_regular ?? equipo?.cantidad_regular));
		setCantMalo(safe(ev?.cantidad_malo ?? equipo?.cantidad_mala));
		setObservaciones(ev?.observaciones ?? equipo?.observaciones ?? "");
		setModo("form");
	};

	const totalIngresado = cantBueno + cantRegular + cantMalo;
	const esValido = totalIngresado > 0 && (cantidadTotal === 0 || totalIngresado === cantidadTotal);

	const mutation = useMutation({
		mutationFn: (payload) => httpClient.post(API_ROUTES.EVALUACIONES.CREATE, payload),
		onSuccess: async () => {
			toast.success("Evaluación registrada correctamente");
			const key = queryKey ?? ["equipos"];
			await queryClient.invalidateQueries({ queryKey: key });
			onClose();
		},
		onError: (error) => {
			const data = error?.response?.data;
			const msg = data?.non_field_errors?.[0] ?? data?.detail ?? "Error al guardar la evaluación";
			toast.error(msg);
		},
	});

	const handleSubmit = async () => {
		if (!esValido || mutation.isPending) return;
		await mutation.mutateAsync({
			equipo: getId(equipo),
			laboratorio: equipo?.laboratorio_id ?? null,
			cantidad_bueno: cantBueno,
			cantidad_regular: cantRegular,
			cantidad_malo: cantMalo,
			observaciones: observaciones.trim(),
		});
	};

	if (!isOpen || !equipo) return null;

	const isPending = mutation.isPending;

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			<div onClick={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }} />

			<div style={{ position: "relative", width: "100%", maxWidth: 540, backgroundColor: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>

				{/* Header */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa", position: "sticky", top: 0, zIndex: 1 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
							<ClipboardCheck size={20} color="#002B5E" />
						</div>
						<div>
							<h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>Evaluación In-Situ</h2>
							<p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, margin: 0, marginTop: 2 }}>
								<span style={{ fontFamily: "monospace", color: "#6b7280" }}>{getCode(equipo)}</span>
								{" · "}{getName(equipo)}
								{cantidadTotal > 0 && <span style={{ color: "#6b7280" }}> · {cantidadTotal} uds.</span>}
							</p>
						</div>
					</div>
					<button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", backgroundColor: "transparent" }} className="hover:bg-gray-100">
						<X size={20} />
					</button>
				</div>

				<div style={{ padding: 24 }}>

					{/* ══ MODO VER ══ */}
					{modo === "ver" && ev && (
						<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
							<p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Distribución de condiciones</p>

							<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
								{CONDICIONES.map(c => (
									<BarraCondicion
										key={c.key}
										label={c.label}
										emoji={c.emoji}
										cantidad={safe(ev[`cantidad_${c.key}`])}
										total={safe(ev.total_unidades)}
										barColor={c.bar}
										textColor={c.text}
										bgColor={c.bg}
									/>
								))}
							</div>

							{/* Condición predominante */}
							{ev.condicion_predominante && (() => {
								const cfg = CONDICIONES.find(c => c.key === ev.condicion_predominante);
								return cfg ? (
									<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
										<span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: cfg.bar }} />
										<span style={{ fontSize: 14, fontWeight: 800, color: cfg.text, textTransform: "uppercase" }}>
											Condición predominante: {cfg.label.replace(/s$/, "")}
										</span>
										<span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: cfg.text }}>{ev.porcentaje_bueno}% bueno</span>
									</div>
								) : null;
							})()}

							{/* Info */}
							<div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<Calendar size={15} color="#9ca3af" />
									<span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{formatFecha(ev.fecha)}</span>
								</div>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<User size={15} color="#9ca3af" />
									<span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{ev.evaluador_nombre ?? "Sin registrar"}</span>
								</div>
							</div>

							{/* Observaciones */}
							<div>
								<p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>Observaciones</p>
								<div style={{ padding: "12px 16px", borderRadius: 10, backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", minHeight: 40 }}>
									<p style={{ fontSize: 14, color: ev.observaciones ? "#374151" : "#9ca3af", fontStyle: ev.observaciones ? "normal" : "italic", margin: 0, lineHeight: 1.5 }}>
										{ev.observaciones || "Sin observaciones"}
									</p>
								</div>
							</div>

							{/* Botones */}
							<div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
								<button onClick={handleReEvaluar} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 10, border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer" }} className="hover:bg-gray-50">
									<RotateCcw size={15} /> Re-evaluar
								</button>
								<button onClick={onClose} style={{ height: 44, padding: "0 24px", borderRadius: 10, backgroundColor: "#002B5E", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,43,94,0.3)" }}>
									Cerrar
								</button>
							</div>
						</div>
					)}

					{/* ══ MODO FORMULARIO ══ */}
					{modo === "form" && (
						<div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
							<div>
								<p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0, marginBottom: 4 }}>
									{yaEvaluado ? "Re-evaluación" : "Nueva evaluación"}
								</p>
								{cantidadTotal > 0 && (
									<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", marginTop: 8 }}>
										<span style={{ fontSize: 14 }}>ℹ️</span>
										<span style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}>Total a distribuir: {cantidadTotal} unidades</span>
									</div>
								)}
							</div>

							{/* Counters */}
							<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
								<p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>Distribución por condición <span style={{ color: "#ef4444" }}>*</span></p>
								{CONDICIONES.map(c => (
									<CounterCondicion
										key={c.key}
										label={c.label}
										emoji={c.emoji}
										value={c.key === "bueno" ? cantBueno : c.key === "regular" ? cantRegular : cantMalo}
										onChange={c.key === "bueno" ? setCantBueno : c.key === "regular" ? setCantRegular : setCantMalo}
										bgColor={c.bg}
										borderColor={c.border}
										textColor={c.text}
									/>
								))}
							</div>

							{/* Suma indicator */}
							{(() => {
								const ok = cantidadTotal === 0 || totalIngresado === cantidadTotal;
								const diff = cantidadTotal - totalIngresado;
								return (
									<div style={{
										display: "flex", alignItems: "center", gap: 10,
										padding: "10px 16px", borderRadius: 10,
										backgroundColor: totalIngresado === 0 ? "#f9fafb" : ok ? "#f0fdf4" : "#fef2f2",
										border: `1.5px solid ${totalIngresado === 0 ? "#e5e7eb" : ok ? "#86efac" : "#fca5a5"}`,
										transition: "all 200ms ease",
									}}>
										<span style={{ fontSize: 16 }}>{totalIngresado === 0 ? "📊" : ok ? "✅" : "⚠️"}</span>
										<span style={{ fontSize: 14, fontWeight: 700, color: totalIngresado === 0 ? "#6b7280" : ok ? "#15803d" : "#991b1b" }}>
											Suma: {totalIngresado}{cantidadTotal > 0 ? ` / ${cantidadTotal}` : ""}
											{cantidadTotal > 0 && !ok && totalIngresado > 0 && (
												<span style={{ fontWeight: 500 }}>
													{diff > 0 ? ` — faltan ${diff}` : ` — sobran ${Math.abs(diff)}`}
												</span>
											)}
										</span>
									</div>
								);
							})()}

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
									style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", backgroundColor: "#fff", padding: "12px 14px", fontSize: 14, fontWeight: 500, color: "#111827", outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
								/>
								<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>{observaciones.length}/500</p>
							</div>

							{/* Botones */}
							<div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
								<button onClick={() => { if (yaEvaluado) setModo("ver"); else onClose(); }} style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "1px solid #e5e7eb", backgroundColor: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
									Cancelar
								</button>
								<button
									onClick={handleSubmit}
									disabled={!esValido || isPending}
									style={{
										display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 24px", borderRadius: 10,
										backgroundColor: !esValido || isPending ? "#9ca3af" : "#002B5E",
										color: "#fff", fontSize: 15, fontWeight: 700, border: "none",
										cursor: !esValido || isPending ? "not-allowed" : "pointer",
										boxShadow: !esValido ? "none" : "0 2px 8px rgba(0,43,94,0.3)",
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
