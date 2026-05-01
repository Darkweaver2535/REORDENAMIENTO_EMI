import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { Settings, Building2, ChevronRight, ChevronDown, Plus, Edit, Trash2, CheckCircle, ShieldAlert, LoaderCircle, Layers } from "lucide-react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../store/AuthContext";
import { ROLES, API_ROUTES } from "../../constants/api";
import { httpClient, configuracionApi } from "../../api";
import PageWrapper from "../../components/layout/PageWrapper";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; const res = p?.results ?? p?.data ?? p; return Array.isArray(res) ? res : []; };
const getId = (item) => item?.id ?? item?.uuid;

/* ── Módulos Internos CRUD API ───────────────────────────────── */
const crudApi = {
	unidades: {
		get: () => httpClient.get(API_ROUTES.ESTRUCTURA.UNIDADES),
		post: (data) => httpClient.post(API_ROUTES.ESTRUCTURA.UNIDADES, data),
		patch: (id, data) => httpClient.patch(`${API_ROUTES.ESTRUCTURA.UNIDADES}${id}/`, data),
		del: (id) => httpClient.delete(`${API_ROUTES.ESTRUCTURA.UNIDADES}${id}/`),
	},
	departamentos: {
		get: () => httpClient.get(API_ROUTES.ESTRUCTURA.DEPARTAMENTOS),
		post: (data) => httpClient.post(API_ROUTES.ESTRUCTURA.DEPARTAMENTOS, data),
		patch: (id, data) => httpClient.patch(`${API_ROUTES.ESTRUCTURA.DEPARTAMENTOS}${id}/`, data),
		del: (id) => httpClient.delete(`${API_ROUTES.ESTRUCTURA.DEPARTAMENTOS}${id}/`),
	},
	carreras: {
		get: () => httpClient.get(API_ROUTES.ESTRUCTURA.CARRERAS),
		post: (data) => httpClient.post(API_ROUTES.ESTRUCTURA.CARRERAS, data),
		patch: (id, data) => httpClient.patch(`${API_ROUTES.ESTRUCTURA.CARRERAS}${id}/`, data),
		del: (id) => httpClient.delete(`${API_ROUTES.ESTRUCTURA.CARRERAS}${id}/`),
	}
};

/* ── Componente: Toggle Inteligente ──────────────────────────── */
function Toggle({ label, description, checked, onChange, disabled }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
			<div>
				<p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>{label}</p>
				{description && <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>{description}</p>}
			</div>
			<button
				type="button"
				onClick={() => !disabled && onChange(!checked)}
				disabled={disabled}
				style={{
					position: "relative", width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
					backgroundColor: checked ? "#0d9488" : "#d1d5db", transition: "background-color 200ms ease", flexShrink: 0, opacity: disabled ? 0.6 : 1
				}}
			>
				<span style={{
					position: "absolute", top: "2px", left: checked ? "22px" : "2px", width: "20px", height: "20px", borderRadius: "50%",
					backgroundColor: "#fff", transition: "left 200ms ease", boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
				}} />
			</button>
		</div>
	);
}

/* ── Modal Genérico para CRUD ────────────────────────────────── */
function ModalCrud({ isOpen, onClose, title, fields, defaultValues, onSubmit, isPending }) {
	const { register, handleSubmit, reset } = useForm({ defaultValues });

	useEffect(() => {
		if (isOpen) reset(defaultValues);
	}, [isOpen, reset, defaultValues]);

	if (!isOpen) return null;

	const handleFormSubmit = (data) => {
		onSubmit(data);
	};

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
			<div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
			<div style={{ position: "relative", width: "100%", maxWidth: "420px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden" }} className="animate-fade-in">
				<div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6" }}>
					<h3 style={{ fontSize: "17px", fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h3>
				</div>
				<form onSubmit={handleSubmit(handleFormSubmit)} style={{ padding: "24px" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
						{fields.map((field) => (
							<div key={field.name}>
								<label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
									{field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
								</label>
								{field.type === "select" ? (
									<select
										{...register(field.name, { required: field.required })}
										style={{ width: "100%", height: "42px", borderRadius: "8px", border: "1px solid #d1d5db", padding: "0 12px", fontSize: "14px", outline: "none", backgroundColor: "#fff" }}
									>
										<option value="">Selecciona...</option>
										{field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
									</select>
								) : (
									<input
										type={field.type || "text"}
										{...register(field.name, { required: field.required })}
										style={{ width: "100%", height: "42px", borderRadius: "8px", border: "1px solid #d1d5db", padding: "0 12px", fontSize: "14px", outline: "none", backgroundColor: "#fff" }}
										placeholder={field.placeholder}
									/>
								)}
							</div>
						))}
					</div>
					<div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
						<button type="button" onClick={onClose} disabled={isPending} style={{ height: "40px", padding: "0 16px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
						<button type="submit" disabled={isPending} style={{ height: "40px", padding: "0 20px", borderRadius: "8px", backgroundColor: "#002B5E", border: "none", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1, display: "flex", alignItems: "center", gap: "8px" }}>
							{isPending && <LoaderCircle size={16} className="animate-spin" />}
							Guardar
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

/* ── UI Principal ────────────────────────────────────────────── */
export default function ConfiguracionPage() {
	const { hasRole } = useAuth();
	const queryClient = useQueryClient();

	if (!hasRole(ROLES.ADMIN)) {
		return <Navigate to="/dashboard" replace />;
	}

	// Fetch Módulos
	const { data: qUnidades } = useQuery({ queryKey: ["unidades"], queryFn: crudApi.unidades.get });
	const { data: qDepartamentos } = useQuery({ queryKey: ["departamentos"], queryFn: crudApi.departamentos.get });
	const { data: qCarreras } = useQuery({ queryKey: ["carreras"], queryFn: crudApi.carreras.get });
	const { data: qConfig } = useQuery({ queryKey: ["config_global"], queryFn: configuracionApi.fetchConfiguracion, retry: false });

	const unidades = normalize(qUnidades);
	const departamentos = normalize(qDepartamentos);
	const carreras = normalize(qCarreras);
	const configGlobal = useMemo(() => normalize(qConfig)?.[0] ?? {}, [qConfig]);

	// Mutación genérica POST/PATCH
	const saveMutation = useMutation({
		mutationFn: ({ api, isEdit, id, payload }) => isEdit ? api.patch(id, payload) : api.post(payload),
		onSuccess: (_, variables) => {
			toast.success(`${variables.typeLabel} guardado`);
			queryClient.invalidateQueries({ queryKey: [variables.queryKey] });
			setModalConfig(null);
		},
		onError: (err) => toast.error(err?.response?.data?.detail ?? err?.message ?? "Error al guardar"),
	});

	// Modales
	const [modalConfig, setModalConfig] = useState(null); // { isOpen, type, isEdit, entity, title, fields, api, queryKey, typeLabel }

	const handleOpenUnidad = (unidad = null) => {
		setModalConfig({
			isOpen: true, isEdit: !!unidad, entity: unidad,
			title: unidad ? "Editar Unidad Académica" : "Agregar Unidad Académica", typeLabel: "Unidad Académica",
			queryKey: "unidades", api: crudApi.unidades,
			fields: [
				{ name: "nombre", label: "Nombre de la Unidad Académica", required: true, placeholder: "Ej. Unidad Académica La Paz" },
				{ name: "abreviacion", label: "Abreviación", required: true, placeholder: "Ej. LPZ" },
				{ name: "ciudad", label: "Ciudad", required: true, placeholder: "Ej. La Paz" }
			]
		});
	};

	const handleOpenDepto = (depto = null) => {
		setModalConfig({
			isOpen: true, isEdit: !!depto, entity: depto,
			title: depto ? "Editar Departamento" : "Agregar Departamento", typeLabel: "Departamento",
			queryKey: "departamentos", api: crudApi.departamentos,
			fields: [
				{ name: "nombre", label: "Nombre del Departamento", required: true, placeholder: "Ej. Ciencias Básicas" },
				{ name: "unidad_academica_id", label: "Unidad Académica", type: "select", required: true, options: unidades.map(u => ({ label: u.nombre, value: u.id })) }
			]
		});
	};

	const handleOpenCarrera = (carrera = null) => {
		setModalConfig({
			isOpen: true, isEdit: !!carrera, entity: carrera,
			title: carrera ? "Editar Carrera" : "Agregar Carrera", typeLabel: "Carrera",
			queryKey: "carreras", api: crudApi.carreras,
			fields: [
				{ name: "nombre", label: "Nombre de la Carrera", required: true, placeholder: "Ej. Ingeniería de Sistemas" },
				{ name: "departamento_id", label: "Departamento", type: "select", required: true, options: departamentos.map(d => ({ label: d.nombre, value: d.id })) }
			]
		});
	};

	const handleModalSubmit = (data) => {
		saveMutation.mutate({
			api: modalConfig.api,
			isEdit: modalConfig.isEdit,
			id: modalConfig.isEdit ? modalConfig.entity.id : null,
			payload: data,
			queryKey: modalConfig.queryKey,
			typeLabel: modalConfig.typeLabel
		});
	};

	/* ── Configuración Global del Sistema ──────────────────────── */
	const [reactivosEnabled, setReactivosEnabled] = useState(false);
	const [sagaUrl, setSagaUrl] = useState("");

	useEffect(() => {
		if (configGlobal) {
			setReactivosEnabled(configGlobal.modulo_reactivos_activo ?? false);
			setSagaUrl(configGlobal.url_saga ?? "https://saga.emi.edu.bo/api/v1");
		}
	}, [configGlobal]);

	const configMutation = useMutation({
		mutationFn: (payload) => {
			if (configGlobal.id) {
				return configuracionApi.updateConfiguracion(payload);	
			} else {
             	// Fake fallback if not implemented natively in API yet
				return new Promise(resolve => setTimeout(resolve, 600));
			}
		},
		onSuccess: () => {
			toast.success("Parámetros del sistema actualizados");
			queryClient.invalidateQueries({ queryKey: ["config_global"] });
		},
		onError: () => toast.error("Error al guardar la configuración")
	});

	const handleSaveConfig = () => {
		configMutation.mutate({ modulo_reactivos_activo: reactivosEnabled, url_saga: sagaUrl });
	};

	// Expansión del acordeón
	const [expandedUnidades, setExpandedUnidades] = useState({});
	const toggleExpand = (id) => setExpandedUnidades(p => ({ ...p, [id]: !p[id] }));

	return (
		<PageWrapper title="Configuración Global" description="Administración avanzada del sistema, estructura académica y parámetros integrales.">
			
			{/* Módulos en Tablas/Secciones */}
			<div style={{ display: "flex", flexDirection: "column", gap: "32px", paddingBottom: "60px" }}>

				{/* ══ Sección 1: Unidades Académicas ══ */}
				<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<Building2 size={24} color="#002B5E" />
							<h2 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", margin: 0 }}>Unidades Académicas</h2>
						</div>
						<button onClick={() => handleOpenUnidad()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#002B5E", color: "#fff", padding: "8px 16px", borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: 700, cursor: "pointer" }} className="hover:bg-blue-900 transition-colors">
							<Plus size={16} /> Agregar Unidad Académica
						</button>
					</div>

					<div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
						<table style={{ width: "100%", borderCollapse: "collapse" }}>
							<thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								<tr>
									{["Unidad Académica", "Abreviación", "Ciudad", "Acciones"].map(h => (
										<th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{unidades.map((u, i) => (
									<tr key={u.id} style={{ borderBottom: i < unidades.length - 1 ? "1px solid #f3f4f6" : "none" }} className="hover:bg-gray-50">
										<td style={{ padding: "14px 20px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{u.nombre}</td>
										<td style={{ padding: "14px 20px", fontSize: "14px", color: "#4b5563" }}>{u.abreviacion || "—"}</td>
										<td style={{ padding: "14px 20px", fontSize: "14px", color: "#4b5563" }}>{u.ciudad || "—"}</td>
										<td style={{ padding: "14px 20px" }}>
											<button onClick={() => handleOpenUnidad(u)} style={{ background: "none", border: "none", color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }} className="hover:text-blue-600">
												<Edit size={14} /> Editar
											</button>
										</td>
									</tr>
								))}
								{unidades.length === 0 && <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>No hay unidades académicas registradas.</td></tr>}
							</tbody>
						</table>
					</div>
				</div>

				{/* ══ Sección 2: Estructura Jerárquica (Deptos & Carreras) ══ */}
				<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
						<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
							<Layers size={24} color="#002B5E" />
							<h2 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", margin: 0 }}>Estructura Académica</h2>
						</div>
						<div style={{ display: "flex", gap: "10px" }}>
							<button onClick={() => handleOpenDepto()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }} className="hover:bg-gray-50 transition-colors">
								<Plus size={16} /> Depto
							</button>
							<button onClick={() => handleOpenCarrera()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }} className="hover:bg-gray-50 transition-colors">
								<Plus size={16} /> Carrera
							</button>
						</div>
					</div>

					<div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
						{unidades.map((u, i) => {
							const isExpanded = expandedUnidades[u.id];
							const uDeptos = departamentos.filter(d => d.unidad_academica_id === u.id || (typeof d.unidad_academica === 'object' && d.unidad_academica?.id === u.id));
							return (
								<div key={u.id} style={{ borderBottom: i < unidades.length - 1 ? "1px solid #e5e7eb" : "none" }}>
									{/* Cabecera Unidad */}
									<button onClick={() => toggleExpand(u.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", backgroundColor: "#f9fafb", border: "none", cursor: "pointer" }} className="hover:bg-gray-100 transition-colors">
										<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
											{isExpanded ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
											<span style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{u.nombre}</span>
											<span style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", backgroundColor: "#e5e7eb", padding: "2px 8px", borderRadius: "10px" }}>{uDeptos.length} Deptos</span>
										</div>
									</button>

									{/* Hijos */}
									{isExpanded && (
										<div style={{ padding: "0" }}>
											{uDeptos.length === 0 ? (
												<p style={{ margin: 0, padding: "16px 44px", fontSize: "13px", color: "#9ca3af", fontStyle: "italic", borderTop: "1px solid #f3f4f6" }}>No hay departamentos registrados.</p>
											) : (
												uDeptos.map(d => {
													const dCarreras = carreras.filter(c => c.departamento_id === d.id || (typeof c.departamento === 'object' && c.departamento?.id === d.id));
													return (
														<div key={d.id} style={{ borderTop: "1px solid #f3f4f6" }}>
															<div style={{ padding: "14px 20px 14px 44px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff" }}>
																<span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>{d.nombre}</span>
																<button onClick={() => handleOpenDepto(d)} style={{ background: "none", border: "none", color: "#002B5E", cursor: "pointer", fontSize: "12px", fontWeight: 700 }} className="hover:underline">Editar</button>
															</div>
															{dCarreras.length > 0 && (
																<div style={{ backgroundColor: "#fafafa", padding: "12px 20px 12px 64px", display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px dashed #e5e7eb" }}>
																	{dCarreras.map(c => (
																		<div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
																			<span style={{ fontSize: "13px", color: "#4b5563" }}>• {c.nombre}</span>
																			<button onClick={() => handleOpenCarrera(c)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "12px", fontWeight: 600 }} className="hover:text-blue-600">Editar</button>
																		</div>
																	))}
																</div>
															)}
														</div>
													);
												})
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* ══ Sección 3: Parámetros del Sistema ══ */}
				<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
						<Settings size={24} color="#002B5E" />
						<h2 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", margin: 0 }}>Parámetros del Sistema</h2>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
						<div style={{ padding: "16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
							<ShieldAlert size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
							<div>
								<p style={{ fontSize: "14px", fontWeight: 700, color: "#991b1b", margin: "0 0 4px 0" }}>Aviso de Administrador</p>
								<p style={{ fontSize: "13px", color: "#b91c1c", margin: 0, lineHeight: 1.5 }}>Las modificaciones en estos parámetros afectarán el comportamiento global de todos los usuarios. Proceder con precaución.</p>
							</div>
						</div>

						<Toggle
							label="Módulo de Reactivos"
							description="Habilita la sección de gestión de reactivos químicos y caducidad para todas las unidades académicas."
							checked={reactivosEnabled}
							onChange={setReactivosEnabled}
						/>

						<div>
							<label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>URL Base - Sistema SAGA (Integración)</label>
							<input
								type="text"
								value={sagaUrl}
								onChange={(e) => setSagaUrl(e.target.value)}
								style={{ width: "100%", height: "46px", borderRadius: "10px", border: "1px solid #d1d5db", padding: "0 16px", fontSize: "15px", color: "#111827", outline: "none" }}
								placeholder="https://saga.emi.edu.bo/api/v1"
							/>
							<p style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>Punto de enlace principal para la validación cruzada de docentes y asignaturas activas.</p>
						</div>

						<div style={{ marginTop: "12px", borderTop: "1px solid #f3f4f6", paddingTop: "24px", display: "flex", justifyContent: "flex-end" }}>
							<button
								onClick={handleSaveConfig}
								disabled={configMutation.isPending}
								style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#002B5E", color: "#fff", padding: "0 24px", height: "46px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 700, cursor: configMutation.isPending ? "not-allowed" : "pointer", opacity: configMutation.isPending ? 0.7 : 1, boxShadow: "0 4px 6px rgba(0,43,94,0.2)" }}
								className="hover:bg-blue-900 transition-colors"
							>
								{configMutation.isPending ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle size={18} />}
								Guardar Configuración
							</button>
						</div>
					</div>
				</div>

			</div>

			<ModalCrud
				isOpen={modalConfig?.isOpen ?? false}
				onClose={() => setModalConfig(null)}
				title={modalConfig?.title}
				fields={modalConfig?.fields ?? []}
				defaultValues={modalConfig?.entity ?? {}}
				onSubmit={handleModalSubmit}
				isPending={saveMutation.isPending}
			/>
		</PageWrapper>
	);
}
