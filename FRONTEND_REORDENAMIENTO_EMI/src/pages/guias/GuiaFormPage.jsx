// src/pages/guias/GuiaFormPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
	ArrowLeft, LoaderCircle, FileText,
	Hash, Image, ChevronDown,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { crearGuia, editarGuia, getGuiaDetalle } from "../../api/guiasApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import Button from "../../components/ui/Button";
import { FiltrosCascada } from "../../components/forms";
import { Navigate } from "react-router-dom";

/* ── Validación Zod ─────────────────────────────────────────── */
const guiaSchema = z.object({
	titulo: z
		.string({ required_error: "El título es obligatorio" })
		.min(3, "El título debe tener al menos 3 caracteres")
		.max(200, "Máximo 200 caracteres"),

	numero_practica: z
		.number({ required_error: "El número de práctica es obligatorio", invalid_type_error: "Ingresa un número" })
		.int("Debe ser un número entero")
		.min(1, "El número mínimo es 1")
		.max(999, "El número máximo es 999"),

	// El PDF se sube como archivo, fuera del schema: react-hook-form no maneja
	// el input file y la validación vive en `validarPdf`.

	portada_url: z
		.union([z.string().url("Ingresa una URL válida"), z.literal("")])
		.optional()
		.transform((val) => val || undefined),
});

/* ── Subcomponentes de UI ───────────────────────────────────── */
function FieldLabel({ htmlFor, children, required }) {
	return (
		<label
			htmlFor={htmlFor}
			style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}
		>
			{children}
			{required && <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>}
		</label>
	);
}

function FieldError({ message }) {
	if (!message) return null;
	return (
		<p style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>
			{message}
		</p>
	);
}

function FieldHint({ children }) {
	return (
		<p style={{ marginTop: "5px", fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
			{children}
		</p>
	);
}

function StyledInput({ id, icon: Icon, error, ...props }) {
	return (
		<div style={{ position: "relative" }}>
			{Icon && (
				<div style={{
					position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
					pointerEvents: "none", display: "flex", alignItems: "center",
				}}>
					<Icon size={18} color={error ? "#ef4444" : "#9ca3af"} />
				</div>
			)}
			<input
				id={id}
				style={{
					width: "100%",
					height: "48px",
					borderRadius: "8px",
					border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
					backgroundColor: error ? "#fff5f5" : "#ffffff",
					paddingLeft: Icon ? "44px" : "16px",
					paddingRight: "16px",
					fontSize: "16px",
					fontWeight: 500,
					color: "#111827",
					outline: "none",
					transition: "border-color 150ms ease, box-shadow 150ms ease",
				}}
				{...props}
			/>
		</div>
	);
}

function SectionCard({ title, children }) {
	return (
		<div
			style={{
				backgroundColor: "#ffffff",
				border: "1px solid #e5e7eb",
				borderRadius: "14px",
				overflow: "hidden",
				boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
			}}
		>
			<div style={{ padding: "20px 28px", borderBottom: "1px solid #f3f4f6" }}>
				<h2 style={{ fontSize: "16px", fontWeight: 700, color: "#374151", letterSpacing: "-0.01em" }}>
					{title}
				</h2>
			</div>
			<div style={{ padding: "28px" }}>
				{children}
			</div>
		</div>
	);
}

/* ── Componente principal ───────────────────────────────────── */
export default function GuiaFormPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const { hasRole } = useAuth();
	const queryClient = useQueryClient();
	const isEdit = Boolean(id);

	// Solo admin/jefe pueden acceder
	if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) {
		return <Navigate to="/guias" replace />;
	}

	// Asignatura seleccionada desde FiltrosCascada
	const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState(null);
	const [asignaturaError, setAsignaturaError] = useState("");

	// PDF: se maneja aparte de react-hook-form (input file).
	const [pdfArchivo, setPdfArchivo] = useState(null);
	const [pdfError, setPdfError] = useState("");
	const [pdfActual, setPdfActual] = useState("");

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
		watch,
	} = useForm({
		resolver: zodResolver(guiaSchema),
		defaultValues: {
			titulo: "",
			numero_practica: "",
			portada_url: "",
		},
	});

	const portadaUrl = watch("portada_url");

	/* ── Query de Guía Existente (Edición) ────────────────────── */
	const { data: guiaExistente } = useQuery({
		queryKey: ["guia", id],
		queryFn: () => getGuiaDetalle(id),
		enabled: isEdit,
	});

	useEffect(() => {
		if (isEdit && guiaExistente) {
			const g = guiaExistente?.data ?? guiaExistente;
			reset({
				titulo: g.titulo,
				numero_practica: g.numero_practica,
				portada_url: g.portada_url || "",
			});
			setPdfActual(g.pdf_url || "");
			// La API devuelve `asignatura_id` (no `asignatura`): leer la clave
			// equivocada dejaba la asignatura sin preseleccionar y al guardar
			// saltaba "Debes seleccionar una asignatura" aunque la guía ya
			// tuviera una. Se conserva el nombre para mostrarlo sin obligar a
			// recorrer de nuevo toda la cascada.
			const idAsignatura = g.asignatura_id ?? g.asignatura?.id ?? g.asignatura;
			if (idAsignatura) {
				setAsignaturaSeleccionada({
					id: idAsignatura,
					nombre: g.asignatura_nombre,
					semestre: g.semestre,
					carrera_nombre: g.carrera_nombre,
				});
			}
		}
	}, [guiaExistente, isEdit, reset]);


	/* ── Mutation ─────────────────────────────────────────────── */
	const { mutateAsync } = useMutation({
		mutationFn: isEdit ? editarGuia : crearGuia,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["guias"] });
		},
	});

	/* ── Submit ───────────────────────────────────────────────── */
	const onSubmit = async (values) => {
		// Validar asignatura manualmente (fuera del schema zod)
		if (!asignaturaSeleccionada?.id) {
			setAsignaturaError("Debes seleccionar una asignatura");
			return;
		}
		setAsignaturaError("");

		// El PDF es obligatorio al crear; al editar sólo si se quiere reemplazar.
		if (!pdfArchivo && !isEdit) {
			setPdfError("Debes subir el PDF de la guía");
			return;
		}
		if (pdfArchivo && !pdfArchivo.name.toLowerCase().endsWith(".pdf")) {
			setPdfError("El archivo debe ser un PDF");
			return;
		}
		if (pdfArchivo && pdfArchivo.size > 30 * 1024 * 1024) {
			setPdfError("El PDF supera el tamaño máximo de 30 MB");
			return;
		}
		setPdfError("");

		try {
			const payload = {
				...values,
				numero_practica: Number(values.numero_practica),
				asignatura: Number(asignaturaSeleccionada.id),
			};
			if (pdfArchivo) payload.pdf_archivo = pdfArchivo;

			if (isEdit) {
				await mutateAsync({ id, data: payload });
				toast.success("¡Guía actualizada exitosamente!");
			} else {
				await mutateAsync(payload);
				toast.success("¡Guía creada exitosamente!");
			}

			navigate("/guias");
		} catch (err) {
			const errorData = err.response?.data;

			if (errorData?.non_field_errors) {
				// Traduce el error técnico a mensaje amigable
				const msg = errorData.non_field_errors[0];
				if (msg.includes("único") || msg.includes("unique")) {
					toast.error(`La Práctica ${values.numero_practica} ya existe para esta asignatura. Usa otro número.`);
				} else {
					toast.error(msg);
				}
			} else {
				// Mostrar TODOS los errores de campos
				const errores = Object.entries(errorData || {})
					.map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs[0] : msgs}`)
					.join(" | ");
				toast.error(errores || "Error al guardar. Revisa los campos.");
			}
			console.error("Error detalle:", errorData);
		}
	};

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<PageWrapper
			title={isEdit ? "Editar guía" : "Nueva guía de laboratorio"}
			description={isEdit ? "Actualiza los datos de la guía." : "Completa el formulario para registrar una nueva práctica."}
			actions={
				<Button variant="secondary" onClick={() => navigate("/guias")}>
					<ArrowLeft size={18} />
					Volver
				</Button>
			}
		>
			<form onSubmit={handleSubmit(onSubmit)} noValidate>
				<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

					{/* ── 1. Identificación ───────────────────────── */}
					<SectionCard title="Identificación de la práctica">
						<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>

							{/* Título */}
							<div>
								<FieldLabel htmlFor="titulo" required>Título de la guía</FieldLabel>
								<StyledInput
									id="titulo"
									type="text"
									placeholder="Ej: Medición de resistencia con multímetro"
									icon={FileText}
									error={errors.titulo}
									{...register("titulo")}
								/>
								<FieldError message={errors.titulo?.message} />
							</div>

							{/* Número de práctica */}
							<div style={{ minWidth: "140px" }}>
								<FieldLabel htmlFor="numero_practica" required>N.º Práctica</FieldLabel>
								<StyledInput
									id="numero_practica"
									type="number"
									placeholder="1"
									min={1}
									max={999}
									icon={Hash}
									error={errors.numero_practica}
									{...register("numero_practica", { valueAsNumber: true })}
								/>
								<FieldError message={errors.numero_practica?.message} />
							</div>
						</div>
					</SectionCard>

					{/* ── 2. Asignatura ───────────────────────────── */}
					<SectionCard title="Asignatura asociada">
						<p style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", marginBottom: "16px" }}>
							Navega la estructura académica para encontrar la asignatura correspondiente.
						</p>

						<FiltrosCascada
							onAsignaturaChange={(asignatura) => {
								setAsignaturaSeleccionada(asignatura);
								if (asignatura) setAsignaturaError("");
							}}
						/>

						{/* Error de asignatura */}
						{asignaturaError && (
							<div style={{
								marginTop: "12px",
								display: "flex", alignItems: "center", gap: "8px",
								padding: "12px 16px", borderRadius: "8px",
								backgroundColor: "#fef2f2", border: "1px solid #fecaca",
							}}>
								<span style={{ color: "#ef4444", fontSize: "16px" }}>⚠</span>
								<p style={{ fontSize: "14px", fontWeight: 600, color: "#b91c1c" }}>{asignaturaError}</p>
							</div>
						)}

						{/* Confirmación de asignatura seleccionada */}
						{asignaturaSeleccionada && !asignaturaError && (
							<div style={{
								marginTop: "12px",
								display: "flex", alignItems: "center", gap: "10px",
								padding: "12px 16px", borderRadius: "8px",
								backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
							}}>
								<span style={{ color: "#16a34a", fontSize: "16px" }}>✓</span>
								<div>
									<p style={{ fontSize: "14px", fontWeight: 600, color: "#15803d" }}>
										{asignaturaSeleccionada?.nombre ?? asignaturaSeleccionada?.titulo ?? `ID: ${asignaturaSeleccionada.id}`}
									</p>
									{/* Al editar, la cascada arranca vacía: este contexto evita
									    tener que recorrerla de nuevo sólo para saber cuál es. */}
									{(asignaturaSeleccionada?.carrera_nombre || asignaturaSeleccionada?.semestre) && (
										<p style={{ fontSize: "13px", fontWeight: 500, color: "#4d7c0f", marginTop: 2 }}>
											{[asignaturaSeleccionada.carrera_nombre,
											  asignaturaSeleccionada.semestre && `${asignaturaSeleccionada.semestre}º semestre`]
												.filter(Boolean).join(" · ")}
											{isEdit && " — cambia los filtros sólo si quieres reasignarla"}
										</p>
									)}
								</div>
							</div>
						)}
					</SectionCard>

					{/* ── 3. Archivos ─────────────────────────────── */}
					<SectionCard title="Archivos">
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

							{/* PDF: archivo subido al servidor */}
							<div>
								<FieldLabel htmlFor="pdf_archivo" required={!isEdit}>
									Archivo PDF de la guía
								</FieldLabel>
								<input
									id="pdf_archivo"
									type="file"
									accept="application/pdf,.pdf"
									onChange={(e) => setPdfArchivo(e.target.files?.[0] ?? null)}
									style={{
										width: "100%",
										padding: "10px 12px",
										fontSize: "14px",
										borderRadius: "10px",
										border: `1px solid ${pdfError ? "#ef4444" : "#e5e7eb"}`,
										background: "#fff",
										cursor: "pointer",
									}}
								/>
								<FieldError message={pdfError} />
								{pdfArchivo ? (
									<FieldHint>
										{pdfArchivo.name} · {(pdfArchivo.size / 1048576).toFixed(1)} MB
									</FieldHint>
								) : pdfActual ? (
									<FieldHint>
										Ya tiene un PDF cargado —{" "}
										<a href={pdfActual} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>
											ver actual
										</a>
										. Elige un archivo sólo si quieres reemplazarlo.
									</FieldHint>
								) : (
									<FieldHint>Selecciona el PDF de la guía (máximo 30 MB).</FieldHint>
								)}
							</div>

							{/* Portada URL */}
							<div>
								<FieldLabel htmlFor="portada_url">URL de portada (opcional)</FieldLabel>
								<StyledInput
									id="portada_url"
									type="url"
									placeholder="https://..."
									icon={Image}
									error={errors.portada_url}
									{...register("portada_url")}
								/>
								<FieldError message={errors.portada_url?.message} />
								<FieldHint>Imagen de portada para la tarjeta. Deja vacío para usar el placeholder.</FieldHint>
							</div>
						</div>

						{/* Preview de portada si hay URL */}
						{portadaUrl && !errors.portada_url && (
							<div style={{ marginTop: "20px" }}>
								<p style={{ fontSize: "13px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>
									Vista previa de portada
								</p>
								<img
									src={portadaUrl}
									alt="Vista previa de portada"
									style={{
										height: "140px",
										borderRadius: "10px",
										objectFit: "cover",
										border: "1px solid #e5e7eb",
									}}
									onError={(e) => { e.target.style.display = "none"; }}
								/>
							</div>
						)}
					</SectionCard>

					{/* ── Footer / Acciones ────────────────────────── */}
					<div
						style={{
							display: "flex",
							justifyContent: "flex-end",
							alignItems: "center",
							gap: "12px",
							padding: "20px 0",
							borderTop: "1px solid #e5e7eb",
						}}
					>
						<Button variant="secondary" type="button" onClick={() => navigate("/guias")}>
							Cancelar
						</Button>

						<button
							type="submit"
							disabled={isSubmitting}
							style={{
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "10px",
								height: "48px",
								padding: "0 28px",
								borderRadius: "10px",
								backgroundColor: "#004F9F",
								color: "#ffffff",
								fontSize: "15px",
								fontWeight: 700,
								cursor: isSubmitting ? "not-allowed" : "pointer",
								opacity: isSubmitting ? 0.6 : 1,
								border: "none",
								boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)",
								transition: "opacity 150ms ease",
							}}
						>
							{isSubmitting ? (
								<>
									<LoaderCircle size={18} className="animate-spin" />
									Guardando...
								</>
							) : (
								<>
									<FileText size={18} />
									{isEdit ? "Guardar cambios" : "Crear guía"}
								</>
							)}
						</button>
					</div>
				</div>
			</form>
		</PageWrapper>
	);
}
