import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, LoaderCircle, Save, Wrench, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, Input, PageWrapper } from "../../components";
import { ROLES } from "../../constants/api";
import {
	fetchEquipos,
	fetchLaboratorios,
	updateEvaluacionInsitu,
} from "../../api/laboratoriosApi";
import { useAuth } from "../../store";

const normalizeList = (data) => {
	if (Array.isArray(data)) {
		return data;
	}

	return data?.results ?? data?.data ?? [];
};

const safeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const getEquipoId = (equipo) => equipo?.id ?? equipo?.uuid ?? equipo?.codigo_activo;

const getEquipoLabel = (equipo) =>
	equipo?.nombre ?? equipo?.descripcion ?? equipo?.nombre_equipo ?? "Equipo";

const getEquipoCode = (equipo) =>
	equipo?.codigo_activo ?? equipo?.codigo ?? equipo?.serial ?? "-";

const getLaboratorioLabel = (laboratorio) =>
	laboratorio?.nombre ?? laboratorio?.descripcion ?? laboratorio?.nombre_laboratorio ?? "Laboratorio";

const getLastEvaluationText = (equipo) =>
	equipo?.ultima_evaluacion ??
	equipo?.last_evaluation ??
	equipo?.evaluacion_fecha ??
	"Sin evaluación previa";

function StatusChip({ equipo }) {
	const disponible = safeNumber(equipo?.cantidad_disponible ?? equipo?.disponible);
	const requerida = safeNumber(equipo?.cantidad_requerida ?? equipo?.requerida);
	const pctUso = safeNumber(equipo?.pct_uso ?? equipo?.porcentaje_uso);

	if (pctUso === 0) {
		return <Badge tone="neutral">Equipo ocioso</Badge>;
	}

	if (disponible >= requerida) {
		return <Badge tone="success">Suficiente</Badge>;
	}

	return <Badge tone="danger">Déficit: {Math.max(requerida - disponible, 0)} unidades</Badge>;
}

function EquipoCard({ equipo, laboratorioId }) {
	const queryClient = useQueryClient();
	const [expanded, setExpanded] = useState(false);
	const [formState, setFormState] = useState(() => ({
		cantidad_buena: safeNumber(equipo?.evaluacion?.cantidad_buena ?? equipo?.cantidad_buena ?? equipo?.buenas),
		cantidad_regular: safeNumber(equipo?.evaluacion?.cantidad_regular ?? equipo?.cantidad_regular ?? equipo?.regulares),
		cantidad_mala: safeNumber(equipo?.evaluacion?.cantidad_mala ?? equipo?.cantidad_mala ?? equipo?.malas),
		ubicacion_sala: equipo?.evaluacion?.ubicacion_sala ?? equipo?.ubicacion_sala ?? equipo?.ubicacion_exacta ?? "",
		observaciones: equipo?.evaluacion?.observaciones ?? equipo?.observaciones ?? "",
	}));
	const [localError, setLocalError] = useState("");

	useEffect(() => {
		setFormState({
			cantidad_buena: safeNumber(equipo?.evaluacion?.cantidad_buena ?? equipo?.cantidad_buena ?? equipo?.buenas),
			cantidad_regular: safeNumber(equipo?.evaluacion?.cantidad_regular ?? equipo?.cantidad_regular ?? equipo?.regulares),
			cantidad_mala: safeNumber(equipo?.evaluacion?.cantidad_mala ?? equipo?.cantidad_mala ?? equipo?.malas),
			ubicacion_sala: equipo?.evaluacion?.ubicacion_sala ?? equipo?.ubicacion_sala ?? equipo?.ubicacion_exacta ?? "",
			observaciones: equipo?.evaluacion?.observaciones ?? equipo?.observaciones ?? "",
		});
	}, [equipo]);

	const totalCalculado = useMemo(
		() => safeNumber(formState.cantidad_buena) + safeNumber(formState.cantidad_regular) + safeNumber(formState.cantidad_mala),
		[formState.cantidad_buena, formState.cantidad_regular, formState.cantidad_mala]
	);

	const totalEquipo = safeNumber(equipo?.cantidad_total ?? equipo?.total ?? equipo?.cantidad);

	const mutation = useMutation({
		mutationFn: (payload) => updateEvaluacionInsitu(getEquipoId(equipo), payload),
		onSuccess: async () => {
			toast.success("Evaluación registrada correctamente");
			setLocalError("");
			await queryClient.invalidateQueries({ queryKey: ["equipos", laboratorioId] });
		},
		onError: () => {
			toast.error("No se pudo registrar la evaluación");
		},
	});

	const handleChange = (field) => (event) => {
		const value = event.target.value;

		setFormState((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();

		const cantidad_buena = safeNumber(formState.cantidad_buena);
		const cantidad_regular = safeNumber(formState.cantidad_regular);
		const cantidad_mala = safeNumber(formState.cantidad_mala);

		if (cantidad_buena < 0 || cantidad_regular < 0 || cantidad_mala < 0) {
			setLocalError("Los valores numéricos no pueden ser negativos");
			return;
		}

		const suma = cantidad_buena + cantidad_regular + cantidad_mala;
		if (suma === 0) {
			setLocalError("Debes ingresar al menos una cantidad mayor a 0.");
			return;
		}

		setLocalError("");

		const payload = {
			cantidad_buena: cantidad_buena,
			cantidad_regular: cantidad_regular,
			cantidad_mala: cantidad_mala,
		};

		if (formState.observaciones?.trim()) {
			payload.observaciones = formState.observaciones.trim();
		}

		if (formState.ubicacion_sala?.trim()) {
			payload.ubicacion_sala = formState.ubicacion_sala.trim();
		}

		await mutation.mutateAsync(payload);
	};

	return (
		<article className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
			<button
				type="button"
				onClick={() => setExpanded((prev) => !prev)}
				className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left
					hover:bg-slate-50/50 transition-colors"
			>
				<div className="flex min-w-0 items-start gap-3">
					<div className="mt-0.5 rounded-lg bg-[#16325c]/10 p-2.5 text-[#2b5ea5] flex-shrink-0">
						<Wrench size={16} />
					</div>
					<div className="min-w-0">
						<h3 className="truncate text-[16px] font-bold text-gray-900">
							[{getEquipoCode(equipo)}] {getEquipoLabel(equipo)}
						</h3>
						<p className="text-[14px] text-gray-500 font-medium mt-1">
							Ubicación: {equipo?.ubicacion_actual ?? equipo?.ubicacion ?? "Sin definir"}
						</p>
						<p className="text-[13px] text-gray-400 font-medium mt-1">
							Última evaluación: {getLastEvaluationText(equipo)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					<StatusChip equipo={equipo} />
					{expanded
						? <ChevronUp size={18} className="text-gray-400" />
						: <ChevronDown size={18} className="text-gray-400" />}
				</div>
			</button>

			{expanded ? (
				<form className="space-y-4 border-t border-slate-100 px-5 py-5 bg-slate-50/30"
					onSubmit={handleSubmit}>
					<div className="grid gap-4 md:grid-cols-3">
						<div>
							<label className="mb-2 block text-[14px] font-bold text-gray-700">
								Buenas
							</label>
							<Input type="number" min="0" value={formState.cantidad_buena} onChange={handleChange("cantidad_buena")} />
						</div>
						<div>
							<label className="mb-2 block text-[14px] font-bold text-gray-700">
								Regulares
							</label>
							<Input type="number" min="0" value={formState.cantidad_regular} onChange={handleChange("cantidad_regular")} />
						</div>
						<div>
							<label className="mb-2 block text-[14px] font-bold text-gray-700">
								Malas
							</label>
							<Input type="number" min="0" value={formState.cantidad_mala} onChange={handleChange("cantidad_mala")} />
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="mb-2 block text-[14px] font-bold text-gray-700">
								Total calculado
							</label>
							<Input value={totalCalculado} readOnly className="bg-slate-100 font-semibold" />
						</div>
						<div>
							<label className="mb-2 block text-[14px] font-bold text-gray-700">
								Total esperado
							</label>
							<Input value={totalEquipo} readOnly className="bg-slate-100 font-semibold" />
						</div>
					</div>

					<div>
						<label className="mb-2 block text-[14px] font-bold text-gray-700">
							Ubicación de la sala
						</label>
						<Input
							type="text"
							value={formState.ubicacion_sala}
							onChange={handleChange("ubicacion_sala")}
							placeholder="Sala, estante, ambiente..."
						/>
					</div>

					<div>
						<label className="mb-2 block text-[14px] font-bold text-gray-700">
							Observaciones
						</label>
						<textarea
							value={formState.observaciones}
							onChange={handleChange("observaciones")}
							rows={3}
							className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5
								text-sm outline-none transition-all placeholder-slate-400
								focus:bg-white focus:border-[#2b5ea5] focus:ring-2 focus:ring-[#2b5ea5]/10"
							placeholder="Notas de la inspección..."
						/>
					</div>

					{localError ? (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
							<AlertCircle size={14} className="text-red-500 flex-shrink-0" />
							<p className="text-xs text-red-700 font-medium">{localError}</p>
						</div>
					) : null}

					<div className="flex items-center justify-end gap-3 pt-2">
						<Button type="submit" disabled={mutation.isPending}>
							{mutation.isPending ? (
								<>
									<LoaderCircle size={14} className="animate-spin" />
									Guardando...
								</>
							) : (
								<>
									<Save size={14} />
									Guardar Evaluación
								</>
							)}
						</Button>
					</div>
				</form>
			) : null}
		</article>
	);
}

function EvaluacionInsituPage() {
	const { user, hasRole } = useAuth();
	const canAccess = hasRole(ROLES.ENCARGADO_ACTIVOS, ROLES.ADMIN);

	const [selectedLaboratorioId, setSelectedLaboratorioId] = useState("");

	const { data: laboratoriosData, isLoading: loadingLaboratorios } = useQuery({
		queryKey: ["laboratorios", user?.unidad_academica_id],
		queryFn: () =>
			fetchLaboratorios({ unidad_academica_id: user?.unidad_academica_id }),
		enabled: Boolean(user?.unidad_academica_id) && canAccess,
	});

	const { data: equiposData, isLoading: loadingEquipos } = useQuery({
		queryKey: ["equipos", selectedLaboratorioId],
		queryFn: () => fetchEquipos({ laboratorio_id: selectedLaboratorioId }),
		enabled: Boolean(selectedLaboratorioId) && canAccess,
	});

	const laboratorios = useMemo(
		() => normalizeList(laboratoriosData),
		[laboratoriosData]
	);
	const equipos = useMemo(() => normalizeList(equiposData), [equiposData]);

	useEffect(() => {
		if (!selectedLaboratorioId && laboratorios.length > 0) {
			setSelectedLaboratorioId(String(getEquipoId(laboratorios[0])));
		}
	}, [laboratorios, selectedLaboratorioId]);

	if (!canAccess) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<PageWrapper
			title="Evaluación in situ"
			description="Registro físico del estado real de los equipos durante la inspección."
		>
			<div className="space-y-6">
				<section className="rounded-xl border border-slate-200/80 bg-white p-5">
					<label className="mb-2 block text-[14px] font-bold text-gray-700">
						Laboratorio
					</label>
					{loadingLaboratorios ? (
						<div className="flex h-10 items-center justify-center rounded-lg
								border border-gray-200 bg-gray-50 text-gray-400">
							<LoaderCircle size={14} className="animate-spin" />
						</div>
					) : (
						<select
							value={selectedLaboratorioId}
							onChange={(event) => setSelectedLaboratorioId(event.target.value)}
							className="w-full rounded-lg border border-slate-200 bg-white
								px-3.5 py-2.5 text-sm outline-none transition-all
								focus:border-[#2b5ea5] focus:ring-2 focus:ring-[#2b5ea5]/10"
						>
							<option value="">Selecciona un laboratorio</option>
							{laboratorios.map((laboratorio) => (
								<option key={getEquipoId(laboratorio)} value={getEquipoId(laboratorio)}>
									{getLaboratorioLabel(laboratorio)}
								</option>
							))}
						</select>
					)}
				</section>

				{!selectedLaboratorioId ? (
					<section className="rounded-xl border border-dashed border-slate-300
							bg-white p-12 text-center">
						<Wrench size={40} className="mx-auto text-gray-300 mb-4" />
						<p className="text-[17px] font-bold text-gray-600">
							Selecciona un laboratorio para ver los equipos
						</p>
					</section>
				) : loadingEquipos ? (
					<section className="space-y-3">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className="h-24 animate-pulse rounded-xl bg-white border border-slate-200/80" />
						))}
					</section>
				) : equipos.length === 0 ? (
					<section className="rounded-xl border border-dashed border-slate-300
							bg-white p-12 text-center">
						<Wrench size={40} className="mx-auto text-gray-300 mb-4" />
						<p className="text-[17px] font-bold text-gray-600">
							No hay equipos para este laboratorio
						</p>
					</section>
				) : (
					<section className="space-y-3">
						{equipos.map((equipo) => (
							<EquipoCard
								key={getEquipoId(equipo)}
								equipo={equipo}
								laboratorioId={selectedLaboratorioId}
							/>
						))}
					</section>
				)}
			</div>
		</PageWrapper>
	);
}

export default EvaluacionInsituPage;