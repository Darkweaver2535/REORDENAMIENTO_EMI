import { useState } from "react";
import { Camera, Monitor, Laptop, Projector, Printer, Package, ExternalLink } from "lucide-react";

/**
 * Los Excel guardan la foto como enlace al VISOR de Google Drive o SharePoint
 * ("…/file/d/<id>/view"), que es una página HTML, no una imagen: puesto en un
 * <img> nunca carga. Para Drive se puede derivar la miniatura, que sí es una
 * imagen. SharePoint no expone un equivalente público, así que en ese caso se
 * ofrece el enlace al original.
 */
function urlDeImagen(url) {
	if (!url) return null;
	const drive = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
		|| url.match(/drive\.google\.com\/open\?id=([^&]+)/)
		|| url.match(/drive\.google\.com\/uc\?(?:export=\w+&)?id=([^&]+)/);
	if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1000`;
	// Carpeta de Drive o cualquier otro visor: no hay imagen directa.
	if (/drive\.google\.com\/drive\/folders/.test(url)) return null;
	if (/sharepoint\.com/.test(url)) return null;
	return url;
}

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
	const src = urlDeImagen(url);

	const dims = { sm: 40, md: 180, lg: 280 }[size] || 180;
	const iconSize = { sm: 20, md: 48, lg: 64 }[size] || 48;
	const radius = { sm: 8, md: 14, lg: 16 }[size] || 14;

	if (src && !error) {
		return (
			<img
				src={src}
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
				url ? (
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 5,
							fontSize: 12,
							color: "#2563eb",
							fontWeight: 600,
						}}
					>
						<ExternalLink size={13} />
						Ver foto original
					</a>
				) : (
					<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
						Sin foto registrada
					</span>
				)
			)}
		</div>
	);
}

export { getEquipoIcon };
