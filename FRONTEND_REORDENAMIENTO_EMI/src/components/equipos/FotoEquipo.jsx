import { useState } from "react";
import { Camera, Monitor, Laptop, Projector, Printer, Package } from "lucide-react";

const ICON_MAP = {
	computadora: Monitor,
	pc: Monitor,
	monitor: Monitor,
	laptop: Laptop,
	notebook: Laptop,
	proyector: Projector,
	impresora: Printer,
};

function getEquipoIcon(nombre) {
	if (!nombre) return Package;
	const lower = nombre.toLowerCase();
	for (const [key, Icon] of Object.entries(ICON_MAP)) {
		if (lower.includes(key)) return Icon;
	}
	return Package;
}

/**
 * Displays equipment photo with fallback icon.
 * @param {{ url: string, nombre: string, size: 'sm'|'md'|'lg' }} props
 */
export default function FotoEquipo({ url, nombre = "", size = "md" }) {
	const [error, setError] = useState(false);
	const Icon = getEquipoIcon(nombre);

	const dims = { sm: 40, md: 180, lg: 280 }[size] || 180;
	const iconSize = { sm: 20, md: 48, lg: 64 }[size] || 48;
	const radius = { sm: 8, md: 14, lg: 16 }[size] || 14;

	if (url && !error) {
		return (
			<img
				src={url}
				alt={nombre || "Equipo"}
				onError={() => setError(true)}
				style={{
					width: size === "sm" ? dims : "100%",
					height: dims,
					objectFit: "cover",
					borderRadius: radius,
					border: "1px solid #e5e7eb",
					backgroundColor: "#f9fafb",
				}}
			/>
		);
	}

	return (
		<div
			style={{
				width: size === "sm" ? dims : "100%",
				height: dims,
				borderRadius: radius,
				border: "2px dashed #e5e7eb",
				backgroundColor: "#f9fafb",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: size === "sm" ? 0 : 8,
			}}
		>
			<Icon size={iconSize} color="#d1d5db" />
			{size !== "sm" && (
				<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
					Sin foto disponible
				</span>
			)}
		</div>
	);
}

export { getEquipoIcon };
