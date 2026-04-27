// src/pages/guias/GuiasPage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { getGuias } from "../../api/guiasApi";
import { ESTADOS_GUIA, ROLES } from "../../constants/api";
import { FiltrosCascada } from "../../components/forms";
import { GuiaCard } from "../../components/ui";
import PageWrapper from "../../components/layout/PageWrapper";
import Button from "../../components/ui/Button";

/* ── Skeleton de tarjeta mentre carga ──────────────────────────── */
function GuiaCardSkeleton() {
	return (
		<div style={{
			backgroundColor: "#ffffff", border: "1px solid #e5e7eb",
			borderRadius: "14px", overflow: "hidden",
		}}>
			{/* Thumbnail */}
			<div style={{ aspectRatio: "16/9", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
			<div style={{ padding: "20px" }}>
				<div style={{ height: "12px", width: "40%", backgroundColor: "#f3f4f6", borderRadius: "6px", marginBottom: "12px" }} className="animate-pulse" />
				<div style={{ height: "18px", width: "85%", backgroundColor: "#f3f4f6", borderRadius: "6px", marginBottom: "8px" }} className="animate-pulse" />
				<div style={{ height: "14px", width: "55%", backgroundColor: "#f3f4f6", borderRadius: "6px", marginBottom: "20px" }} className="animate-pulse" />
				<div style={{ height: "44px", width: "100%", backgroundColor: "#f3f4f6", borderRadius: "10px" }} className="animate-pulse" />
			</div>
		</div>
	);
}

/* ── Componente principal ───────────────────────────────────────── */
export default function GuiasPage() {
	const navigate = useNavigate();
	const { hasRole } = useAuth();

	// Estado de la asignatura seleccionada (objeto completo del FiltrosCascada)
	const [selectedAsignatura, setSelectedAsignatura] = useState(null);

	const isManager = hasRole(ROLES.ADMIN, ROLES.JEFE);

	/* ── React Query: guías ───────────────────────────────────── */
	const {
		data: guiasRaw,
		isLoading,
		isFetching,
	} = useQuery({
		queryKey: ["guias", selectedAsignatura?.id ?? selectedAsignatura],
		queryFn: () => {
			const id = selectedAsignatura?.id ?? selectedAsignatura;
			return getGuias(id);
		},
		enabled: Boolean(selectedAsignatura?.id ?? selectedAsignatura),
	});

	/* ── Normalizar respuesta ─────────────────────────────────── */
	const guias = useMemo(() => {
		if (!guiasRaw) return [];
		if (Array.isArray(guiasRaw)) return guiasRaw;
		return guiasRaw.results ?? guiasRaw.data ?? [];
	}, [guiasRaw]);

	/* ── Filtrar para estudiantes ─────────────────────────────── */
	const displayedGuias = useMemo(() => {
		if (isManager) return guias;
		return guias.filter(
			(g) => String(g?.estado ?? "").toLowerCase() === ESTADOS_GUIA.PUBLICADO
		);
	}, [guias, isManager]);

	const hasAsignatura = Boolean(selectedAsignatura?.id ?? selectedAsignatura);
	const showSkeleton = hasAsignatura && (isLoading || isFetching);

	/* ── Render ───────────────────────────────────────────────── */
	return (
		<PageWrapper
			title="Guías de Laboratorio"
			description="Busca y descarga prácticas por asignatura y sede."
			actions={
				isManager ? (
					<Button onClick={() => navigate("/guias/nueva")}>
						<Plus size={18} />
						Nueva Guía
					</Button>
				) : null
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

				{/* ── Filtros en cascada ─────────────────────────── */}
				<FiltrosCascada
					onAsignaturaChange={(asignatura) => setSelectedAsignatura(asignatura)}
				/>

				{/* ── Área de resultados ────────────────────────── */}

				{/* Sin selección */}
				{!hasAsignatura && (
					<EmptyState
						icon={<Search size={44} color="#d1d5db" />}
						title="Selecciona una asignatura"
						desc="Utiliza los filtros de arriba para navegar por la estructura académica y ver las prácticas disponibles."
					/>
				)}

				{/* Skeleton de carga */}
				{showSkeleton && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
						{[1, 2, 3].map((i) => <GuiaCardSkeleton key={i} />)}
					</div>
				)}

				{/* Sin resultados */}
				{hasAsignatura && !showSkeleton && displayedGuias.length === 0 && (
					<EmptyState
						icon={<BookOpen size={44} color="#d1d5db" />}
						title="Sin guías publicadas"
						desc="No hay guías publicadas para esta asignatura. Si eres docente, puedes crear una nueva."
					/>
				)}

				{/* Grid de tarjetas */}
				{hasAsignatura && !showSkeleton && displayedGuias.length > 0 && (
					<div style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
						gap: "20px",
					}}>
						{displayedGuias.map((guia) => (
							<GuiaCard
								key={guia?.id ?? guia?.uuid ?? guia?.titulo}
								guia={guia}
								onEdit={(g) => {
									const id = g?.id ?? g?.uuid;
									if (id) navigate(`/guias/${id}/editar`);
								}}
								onStatusChange={(g) => {
									// Placeholder: implementar modal de cambio de estado
									window.alert(`Cambiar estado de: ${g?.titulo ?? "Guía"}`);
								}}
							/>
						))}
					</div>
				)}
			</div>
		</PageWrapper>
	);
}

/* ── Empty state reutilizable ───────────────────────────────────── */
function EmptyState({ icon, title, desc }) {
	return (
		<div
			style={{
				display: "flex", flexDirection: "column", alignItems: "center",
				justifyContent: "center", textAlign: "center",
				padding: "64px 32px",
				backgroundColor: "#ffffff",
				border: "2px dashed #e5e7eb",
				borderRadius: "14px",
				gap: "12px",
			}}
		>
			{icon}
			<h3 style={{ fontSize: "18px", fontWeight: 700, color: "#374151", marginTop: "8px" }}>
				{title}
			</h3>
			<p style={{ fontSize: "15px", fontWeight: 500, color: "#9ca3af", maxWidth: "400px" }}>
				{desc}
			</p>
		</div>
	);
}
