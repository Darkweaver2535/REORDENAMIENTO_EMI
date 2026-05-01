// src/pages/admin/UsuariosPage.jsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Users, Edit, UserCheck, UserX, LoaderCircle, AlertCircle, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

import { useAuth } from "../../store/AuthContext";
import { ROLES, API_ROUTES } from "../../constants/api";
import { usuariosApi, httpClient } from "../../api";
import PageWrapper from "../../components/layout/PageWrapper";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => {
	if (!d) return [];
	const p = d?.data ?? d;
	if (Array.isArray(p)) return p;
	return p?.results ?? p?.data ?? [];
};

const getRoleColor = (rol) => {
	switch (String(rol).toLowerCase()) {
		case "admin": return { bg: "#fee2e2", text: "#991b1b" }; // Red
		case "jefe": return { bg: "#e0e7ff", text: "#3730a3" }; // Indigo
		case "docente": return { bg: "#dcfce7", text: "#166534" }; // Green
		case "estudiante": return { bg: "#f3f4f6", text: "#374151" }; // Gray
		case "encargado_activos": return { bg: "#fce7f3", text: "#9d174d" }; // Pink
		default: return { bg: "#f3f4f6", text: "#374151" };
	}
};

/* ── Sub-componentes ─────────────────────────────────────────── */
function ModalRoleEdit({ user, isOpen, onClose }) {
	const queryClient = useQueryClient();

	const { data: unidadesData } = useQuery({
		queryKey: ["unidades"],
		queryFn: () => httpClient.get(API_ROUTES.ESTRUCTURA.UNIDADES),
		staleTime: 5 * 60 * 1000,
	});

	const unidades = useMemo(() => normalize(unidadesData), [unidadesData]);

	const [form, setForm] = useState({
		rol: user?.rol ?? "ESTUDIANTE",
		unidad_academica_id: user?.unidad_academica_id ?? "",
	});

	const mutation = useMutation({
		mutationFn: (payload) => usuariosApi.updateUsuario(user?.id ?? user?.uuid, payload),
		onSuccess: () => {
			toast.success(`Rol de ${user?.nombre_completo} actualizado`);
			queryClient.invalidateQueries({ queryKey: ["usuarios"] });
			onClose();
		},
		onError: (err) => {
			const detail = err?.response?.data?.detail ?? err?.message ?? "Error al actualizar";
			toast.error(detail);
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		mutation.mutate({ rol: form.rol, unidad_academica_id: form.unidad_academica_id || null });
	};

	if (!isOpen) return null;

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
			<div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
			<div style={{ position: "relative", width: "100%", maxWidth: "420px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", overflow: "hidden" }} className="animate-fade-in">
				<div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<h3 style={{ fontSize: "17px", fontWeight: 700, color: "#111827", margin: 0 }}>Editar Rol</h3>
					<button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#9ca3af" }} className="hover:text-gray-700"><X size={20} /></button>
				</div>
				<form onSubmit={handleSubmit} style={{ padding: "24px" }}>
					<p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "20px" }}>
						Modificando rol de: <strong style={{ color: "#111827" }}>{user?.nombre_completo}</strong>
					</p>

					<div style={{ marginBottom: "16px" }}>
						<label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>Rol del sistema</label>
						<select
							value={form.rol}
							onChange={(e) => setForm({ ...form, rol: e.target.value })}
							style={{ width: "100%", height: "42px", borderRadius: "8px", border: "1px solid #d1d5db", padding: "0 12px", fontSize: "14px", backgroundColor: "#fff", color: "#111827", outline: "none" }}
						>
							<option value="ESTUDIANTE">Estudiante</option>
							<option value="DOCENTE">Docente</option>
							<option value="JEFE">Jefe de Laboratorio</option>
							<option value="ENCARGADO_ACTIVOS">Encargado de Activos</option>
							<option value="ADMIN">Administrador Central</option>
						</select>
					</div>

					<div style={{ marginBottom: "24px" }}>
						<label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>Unidad Académica</label>
						<select
							value={form.unidad_academica_id}
							onChange={(e) => setForm({ ...form, unidad_academica_id: e.target.value })}
							style={{ width: "100%", height: "42px", borderRadius: "8px", border: "1px solid #d1d5db", padding: "0 12px", fontSize: "14px", backgroundColor: "#fff", color: "#111827", outline: "none" }}
						>
							<option value="">Sin unidad académica específica (Nacional)</option>
							{unidades.map((u) => (
								<option key={u.id} value={u.id}>{u.nombre}</option>
							))}
						</select>
					</div>

					<div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
						<button type="button" onClick={onClose} style={{ height: "40px", padding: "0 16px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
						<button type="submit" disabled={mutation.isPending} style={{ height: "40px", padding: "0 20px", borderRadius: "8px", backgroundColor: "#002B5E", border: "none", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: mutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", opacity: mutation.isPending ? 0.7 : 1 }}>
							{mutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle size={16} />}
							Guardar cambios
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

/* ── Página principal ────────────────────────────────────────── */
export default function UsuariosPage() {
	const { hasRole, user: currentUser } = useAuth();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [selectedUser, setSelectedUser] = useState(null);
	const pageSize = 20;

	if (!hasRole(ROLES.ADMIN)) {
		return <Navigate to="/dashboard" replace />;
	}

	const { data, isLoading, isError } = useQuery({
		queryKey: ["usuarios", page],
		queryFn: () => usuariosApi.fetchUsuarios({ page, page_size: pageSize }),
		staleTime: 60 * 1000,
	});

	// La paginación en Django DRF puede devolver: { count, next, previous, results: [...] }
	const users = useMemo(() => {
		const raw = data?.data?.results ?? data?.data;
		return Array.isArray(raw) ? raw : [];
	}, [data]);
	const totalCount = data?.data?.count ?? users.length;
	const totalPages = Math.ceil(totalCount / pageSize) || 1;

	const toggleMutation = useMutation({
		mutationFn: ({ id, is_active }) => usuariosApi.updateUsuario(id, { is_active }),
		onSuccess: (data, variables) => {
			toast.success(variables.is_active ? "Usuario habilitado" : "Usuario inhabilitado");
			queryClient.invalidateQueries({ queryKey: ["usuarios"] });
		},
		onError: () => toast.error("Error al actualizar estado del usuario"),
	});

	const handleToggleActive = (user) => {
		if (user.id === currentUser?.id) {
			toast.error("No puedes inhabilitar tu propia cuenta");
			return;
		}
		toggleMutation.mutate({ id: user.id ?? user.uuid, is_active: !user.is_active });
	};

	return (
		<PageWrapper
			title="Gestión de Usuarios"
			description="Administra los roles, unidades académicas y accesos de los usuarios en el sistema."
		>
			<div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
				<div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "10px" }}>
					<Users size={20} color="#002B5E" />
					<h2 style={{ fontSize: "16px", fontWeight: 700, color: "#374151", margin: 0 }}>Usuarios del Sistema</h2>
				</div>

				<div style={{ overflowX: "auto" }}>
					<table style={{ minWidth: "900px", width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
								{["CI", "Nombre Completo", "Rol Asignado", "Unidad Académica", "Estado", "Acciones"].map(h => (
									<th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{h}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{isLoading && [1, 2, 3, 4, 5].map(i => (
								<tr key={i}><td colSpan={6} style={{ padding: "16px 20px" }}><div style={{ height: "14px", backgroundColor: "#f3f4f6", borderRadius: "6px" }} className="animate-pulse" /></td></tr>
							))}

							{!isLoading && users.map((u, i) => {
								const id = u?.id ?? u?.uuid;
								const ci = u?.ci ?? u?.documento_identidad ?? "—";
								const roleColors = getRoleColor(u?.rol);
								const unidadNombre = u?.unidad_academica_nombre ?? "—";
								
								return (
									<tr key={id || i} style={{ borderBottom: i < users.length - 1 ? "1px solid #f3f4f6" : "none" }} className="hover:bg-gray-50">
										<td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280", fontWeight: 500 }}>{ci}</td>
										<td style={{ padding: "14px 20px" }}>
											<p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: 0 }}>{u?.nombre_completo}</p>
											<p style={{ fontSize: "13px", color: "#9ca3af", margin: "2px 0 0 0" }}>{u?.email || `${ci}@emi.edu.bo`}</p>
										</td>
										<td style={{ padding: "14px 20px" }}>
											<span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "6px", backgroundColor: roleColors.bg, color: roleColors.text, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
												{u?.rol}
											</span>
										</td>
										<td style={{ padding: "14px 20px", fontSize: "14px", color: "#4b5563", fontWeight: 500 }}>{unidadNombre}</td>
										<td style={{ padding: "14px 20px" }}>
											<button
												onClick={() => handleToggleActive(u)}
												disabled={toggleMutation.isPending && toggleMutation.variables?.id === id}
												style={{
													display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", border: "none",
													backgroundColor: u?.is_active ? "#f0fdf4" : "#fef2f2",
													color: u?.is_active ? "#16a34a" : "#dc2626",
													fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "opacity 150ms ease"
												}}
												className="hover:opacity-80"
											>
												{u?.is_active ? <UserCheck size={16} /> : <UserX size={16} />}
												{u?.is_active ? "Activo" : "Inactivo"}
											</button>
										</td>
										<td style={{ padding: "14px 20px" }}>
											<button
												onClick={() => setSelectedUser(u)}
												style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", backgroundColor: "#fff", border: "1px solid #d1d5db", color: "#374151", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
												className="hover:bg-gray-50"
											>
												<Edit size={14} /> Editar Rol
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{/* Paginación */}
				{!isLoading && totalPages > 1 && (
					<div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb", backgroundColor: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>
							Página <strong style={{ color: "#111827" }}>{page}</strong> de <strong style={{ color: "#111827" }}>{totalPages}</strong>
						</span>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								onClick={() => setPage(p => Math.max(1, p - 1))}
								disabled={page === 1}
								style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", backgroundColor: page === 1 ? "#f3f4f6" : "#fff", color: page === 1 ? "#9ca3af" : "#374151", fontSize: "13px", fontWeight: 600, cursor: page === 1 ? "not-allowed" : "pointer" }}
							>
								Anterior
							</button>
							<button
								onClick={() => setPage(p => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
								style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", backgroundColor: page === totalPages ? "#f3f4f6" : "#fff", color: page === totalPages ? "#9ca3af" : "#374151", fontSize: "13px", fontWeight: 600, cursor: page === totalPages ? "not-allowed" : "pointer" }}
							>
								Siguiente
							</button>
						</div>
					</div>
				)}
			</div>

			<ModalRoleEdit
				isOpen={Boolean(selectedUser)}
				user={selectedUser}
				onClose={() => setSelectedUser(null)}
			/>
		</PageWrapper>
	);
}
