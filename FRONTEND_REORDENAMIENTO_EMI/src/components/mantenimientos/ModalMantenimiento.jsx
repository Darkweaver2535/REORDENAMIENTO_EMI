import { useState, useEffect } from "react";
import { X } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { API_ROUTES } from "../../constants/api";

const TIPO_CHOICES = [
	{ value: "preventivo",   label: "Mantenimiento Preventivo" },
	{ value: "correctivo",   label: "Mantenimiento Correctivo" },
	{ value: "limpieza",     label: "Limpieza y Desinfección" },
	{ value: "reparacion",   label: "Reparación" },
	{ value: "calibracion",  label: "Calibración" },
	{ value: "verificacion", label: "Verificación Técnica" },
];

const ESTADO_CHOICES = [
	{ value: "realizado",  label: "Realizado" },
	{ value: "pendiente",  label: "Pendiente" },
	{ value: "en_proceso", label: "En Proceso" },
	{ value: "cancelado",  label: "Cancelado" },
];

const labelStyle = { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" };
const inputStyle = {
	width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: 10,
	border: "1px solid #e5e7eb", outline: "none", boxSizing: "border-box",
	transition: "border-color 150ms ease",
};
const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer",
	backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
	backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

const DEFAULTS = {
	tipo: "preventivo", estado: "realizado", descripcion: "", observaciones: "",
	fecha_realizacion: new Date().toISOString().split("T")[0], fecha_proximo: "",
	numero_certificado: "", entidad_calibradora: "",
};

export default function ModalMantenimiento({ equipoId, registro, isOpen, onClose, onGuardado }) {
	const [form, setForm] = useState(DEFAULTS);
	const [errors, setErrors] = useState({});
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (isOpen) {
			if (registro) {
				setForm({
					tipo: registro.tipo || "preventivo",
					estado: registro.estado || "realizado",
					descripcion: registro.descripcion || "",
					observaciones: registro.observaciones || "",
					fecha_realizacion: registro.fecha_realizacion || "",
					fecha_proximo: registro.fecha_proximo || "",
					numero_certificado: registro.numero_certificado || "",
					entidad_calibradora: registro.entidad_calibradora || "",
				});
			} else {
				setForm({ ...DEFAULTS, fecha_realizacion: new Date().toISOString().split("T")[0] });
			}
			setErrors({});
		}
	}, [isOpen, registro]);

	const esCalibracion = ["calibracion", "verificacion"].includes(form.tipo);

	const validate = () => {
		const e = {};
		if (!form.tipo) e.tipo = "Requerido";
		if (!form.estado) e.estado = "Requerido";
		if (!form.fecha_realizacion) e.fecha_realizacion = "Requerido";
		if (!form.descripcion || form.descripcion.trim().length < 10) e.descripcion = "Mínimo 10 caracteres";
		setErrors(e);
		return Object.keys(e).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!validate()) return;
		setSaving(true);
		try {
			const payload = { ...form, equipo: equipoId };
			// DRF rechaza "" en campos nullable (DateField, CharField null=True) → enviar null
			const nullables = ["fecha_proximo", "numero_certificado", "entidad_calibradora", "observaciones"];
			nullables.forEach(k => { if (!payload[k]) payload[k] = null; });
			if (!esCalibracion) {
				payload.numero_certificado = null;
				payload.entidad_calibradora = null;
			}
			if (registro) {
				await axiosClient.put(API_ROUTES.MANTENIMIENTOS.UPDATE(registro.id), payload);
			} else {
				await axiosClient.post(API_ROUTES.MANTENIMIENTOS.CREATE, payload);
			}
			await onGuardado();
			onClose();
		} catch (err) {
			console.error("Error guardando mantenimiento:", err);
			const detail = err?.response?.data;
			if (detail && typeof detail === "object") {
				setErrors(detail);
			}
		} finally {
			setSaving(false);
		}
	};

	if (!isOpen) return null;

	const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			<div style={{
				backgroundColor: "#fff", borderRadius: 18, width: "100%", maxWidth: 560,
				maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
			}}>
				{/* Header */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #f3f4f6" }}>
					<h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
						{registro ? "Editar Registro" : "Agregar Registro"}
					</h2>
					<button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}>
						<X size={20} />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
					{/* Row: Tipo + Estado */}
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
						<div>
							<label style={labelStyle}>Tipo *</label>
							<select value={form.tipo} onChange={set("tipo")} style={selectStyle}>
								{TIPO_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
							</select>
							{errors.tipo && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{errors.tipo}</p>}
						</div>
						<div>
							<label style={labelStyle}>Estado *</label>
							<select value={form.estado} onChange={set("estado")} style={selectStyle}>
								{ESTADO_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
							</select>
							{errors.estado && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{errors.estado}</p>}
						</div>
					</div>

					{/* Fecha realización */}
					<div>
						<label style={labelStyle}>Fecha de realización *</label>
						<input type="date" value={form.fecha_realizacion} onChange={set("fecha_realizacion")} style={inputStyle} />
						{errors.fecha_realizacion && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{errors.fecha_realizacion}</p>}
					</div>

					{/* Descripción */}
					<div>
						<label style={labelStyle}>Descripción del trabajo *</label>
						<textarea
							value={form.descripcion} onChange={set("descripcion")}
							rows={3} placeholder="Detalle del mantenimiento realizado..."
							style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
						/>
						{errors.descripcion && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{errors.descripcion}</p>}
					</div>

					{/* Calibración fields */}
					{esCalibracion && (
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: 16, backgroundColor: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
							<div>
								<label style={labelStyle}>N° Certificado</label>
								<input type="text" value={form.numero_certificado} onChange={set("numero_certificado")} style={inputStyle} placeholder="Opcional" />
							</div>
							<div>
								<label style={labelStyle}>Entidad calibradora</label>
								<input type="text" value={form.entidad_calibradora} onChange={set("entidad_calibradora")} style={inputStyle} placeholder="Opcional" />
							</div>
						</div>
					)}

					{/* Próximo servicio */}
					<div>
						<label style={labelStyle}>Fecha próximo servicio</label>
						<input type="date" value={form.fecha_proximo} onChange={set("fecha_proximo")} style={inputStyle} />
						<p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>¿Cuándo se debe hacer el próximo? (opcional)</p>
					</div>

					{/* Observaciones */}
					<div>
						<label style={labelStyle}>Observaciones</label>
						<textarea
							value={form.observaciones} onChange={set("observaciones")}
							rows={2} placeholder="Observaciones adicionales... (opcional)"
							style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
						/>
					</div>

					{/* Actions */}
					<div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
						<button type="button" onClick={onClose} style={{
							padding: "10px 20px", borderRadius: 10, border: "1px solid #e5e7eb",
							backgroundColor: "#fff", fontSize: 14, fontWeight: 700, color: "#6b7280", cursor: "pointer",
						}}>
							Cancelar
						</button>
						<button type="submit" disabled={saving} style={{
							padding: "10px 24px", borderRadius: 10, border: "none",
							backgroundColor: "#002B5E", fontSize: 14, fontWeight: 700, color: "#fff",
							cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
							boxShadow: "0 2px 8px rgba(0,43,94,0.3)", transition: "opacity 150ms ease",
						}}>
							{saving ? "Guardando..." : registro ? "Actualizar" : "Guardar"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
