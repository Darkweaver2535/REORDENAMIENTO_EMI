import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, PackagePlus } from "lucide-react";
import toast from "react-hot-toast";
import axiosClient from "../../api/axiosClient";
import { API_ROUTES } from "../../constants/api";

/**
 * Alta de un equipo en el inventario.
 *
 * El asistente de reordenamiento indica "ve primero a Inventario → Equipos →
 * Nuevo equipo", pero esa acción no existía: la API y los permisos ya estaban
 * listos y sólo faltaba el formulario, así que el flujo de Compra quedaba roto.
 *
 * Reglas del modelo que el formulario respeta:
 *  · cada equipo es UNA unidad física (cantidad_total 0 ó 1);
 *  · el estado elegido determina en qué contador cae esa unidad;
 *  · debe pertenecer a una unidad académica, directamente o vía laboratorio;
 *  · sólo se puede asignar a un laboratorio hoja (sin subespacios).
 */
const ESTADOS = [
	{ valor: "bueno", etiqueta: "Bueno" },
	{ valor: "regular", etiqueta: "Regular" },
	{ valor: "malo", etiqueta: "Malo" },
];

const VACIO = {
	nombre: "",
	codigo_activo: "",
	unidad_academica_id: "",
	laboratorio_id: "",
	tipo_id: "",
	estatus_general: "bueno",
};

export default function ModalNuevoEquipo({ abierto, onClose, laboratorios = [], unidades = [], tipos = [] }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState(VACIO);
	const [errores, setErrores] = useState({});

	useEffect(() => {
		if (abierto) {
			setForm(VACIO);
			setErrores({});
		}
	}, [abierto]);

	// Sólo los nodos hoja admiten equipos; ofrecer los demás produciría un 400.
	const labsAsignables = laboratorios.filter((l) => l?.es_hoja !== false);

	const mutation = useMutation({
		mutationFn: (payload) => axiosClient.post(API_ROUTES.LABORATORIOS.EQUIPOS, payload),
		onSuccess: () => {
			toast.success("Equipo registrado");
			queryClient.invalidateQueries({ queryKey: ["all-equipos"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard-metricas"] });
			onClose();
		},
		onError: (err) => {
			const data = err?.response?.data;
			if (data && typeof data === "object" && !Array.isArray(data)) setErrores(data);
			const primero =
				data?.detail ??
				(data && typeof data === "object"
					? Object.values(data).flat().find((x) => typeof x === "string")
					: null);
			toast.error(primero ?? "No se pudo registrar el equipo");
		},
	});

	if (!abierto) return null;

	const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

	const enviar = (e) => {
		e.preventDefault();
		const errs = {};
		if (!form.nombre.trim()) errs.nombre = ["El nombre es obligatorio"];
		if (!form.codigo_activo.trim()) errs.codigo_activo = ["El código de activo es obligatorio"];
		if (!form.laboratorio_id && !form.unidad_academica_id)
			errs.unidad_academica_id = ["Indica la unidad académica o un laboratorio"];
		setErrores(errs);
		if (Object.keys(errs).length) return;

		// Una unidad física: el estado decide en qué contador se registra.
		const cantidades = { cantidad_buena: 0, cantidad_regular: 0, cantidad_mala: 0 };
		cantidades[`cantidad_${form.estatus_general === "malo" ? "mala" : form.estatus_general === "regular" ? "regular" : "buena"}`] = 1;

		mutation.mutate({
			nombre: form.nombre.trim(),
			codigo_activo: form.codigo_activo.trim(),
			estatus_general: form.estatus_general,
			cantidad_total: 1,
			...cantidades,
			...(form.laboratorio_id ? { laboratorio_id: Number(form.laboratorio_id) } : {}),
			...(form.unidad_academica_id ? { unidad_academica_id: Number(form.unidad_academica_id) } : {}),
			...(form.tipo_id ? { tipo_id: Number(form.tipo_id) } : {}),
		});
	};

	const err = (campo) => (Array.isArray(errores[campo]) ? errores[campo][0] : errores[campo]);
	const inputStyle = (campo) => ({
		width: "100%", height: 42, borderRadius: 8, padding: "0 12px", fontSize: 14,
		border: `1px solid ${err(campo) ? "#f87171" : "#d1d5db"}`, outline: "none", backgroundColor: "#fff",
	});
	const Label = ({ children, requerido }) => (
		<label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
			{children} {requerido && <span style={{ color: "#ef4444" }}>*</span>}
		</label>
	);
	const Error = ({ campo }) =>
		err(campo) ? (
			<p style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{err(campo)}</p>
		) : null;

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
			<div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
			<div style={{ position: "relative", width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden" }}>
				<div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10 }}>
					<PackagePlus size={20} color="#004F9F" />
					<h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>Nuevo equipo</h3>
				</div>

				<form onSubmit={enviar} style={{ padding: 24 }}>
					<div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
						<div>
							<Label requerido>Nombre del equipo</Label>
							<input value={form.nombre} onChange={set("nombre")} style={inputStyle("nombre")}
								placeholder="Ej. Microscopio binocular" />
							<Error campo="nombre" />
						</div>

						<div>
							<Label requerido>Código de activo</Label>
							<input value={form.codigo_activo} onChange={set("codigo_activo")} style={inputStyle("codigo_activo")}
								placeholder="Ej. 1-12345" />
							<Error campo="codigo_activo" />
						</div>

						<div>
							<Label>Laboratorio</Label>
							<select value={form.laboratorio_id} onChange={set("laboratorio_id")} style={inputStyle("laboratorio_id")}>
								<option value="">Sin asignar (queda pendiente de ubicación)</option>
								{labsAsignables.map((l) => (
									<option key={l.id} value={l.id}>
										{l.nombre}{l.unidad_academica_nombre ? ` — ${l.unidad_academica_nombre}` : ""}
									</option>
								))}
							</select>
							<Error campo="laboratorio_id" />
						</div>

						<div>
							<Label requerido={!form.laboratorio_id}>Unidad académica</Label>
							<select value={form.unidad_academica_id} onChange={set("unidad_academica_id")} style={inputStyle("unidad_academica_id")}>
								<option value="">{form.laboratorio_id ? "Se hereda del laboratorio" : "Selecciona…"}</option>
								{unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
							</select>
							<Error campo="unidad_academica_id" />
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
							<div>
								<Label>Tipo de equipo</Label>
								<select value={form.tipo_id} onChange={set("tipo_id")} style={inputStyle("tipo_id")}>
									<option value="">Sin clasificar</option>
									{tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
								</select>
							</div>
							<div>
								<Label requerido>Estado</Label>
								<select value={form.estatus_general} onChange={set("estatus_general")} style={inputStyle("estatus_general")}>
									{ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
								</select>
							</div>
						</div>
					</div>

					<div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
						<button type="button" onClick={onClose} disabled={mutation.isPending}
							style={{ height: 40, padding: "0 16px", borderRadius: 8, backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
							Cancelar
						</button>
						<button type="submit" disabled={mutation.isPending}
							style={{ height: 40, padding: "0 20px", borderRadius: 8, backgroundColor: "#004F9F", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: mutation.isPending ? "not-allowed" : "pointer", opacity: mutation.isPending ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8 }}>
							{mutation.isPending && <LoaderCircle size={16} className="animate-spin" />}
							Registrar equipo
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
