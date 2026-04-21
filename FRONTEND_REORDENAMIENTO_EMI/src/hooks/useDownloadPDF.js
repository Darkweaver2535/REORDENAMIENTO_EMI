// src/hooks/useDownloadPDF.js
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import axiosClient from "../api/axiosClient";

/**
 * Custom hook reutilizable para descarga de PDFs desde el backend.
 *
 * @returns {{ downloadPDF: Function, isDownloading: boolean }}
 *
 * Uso:
 *   const { downloadPDF, isDownloading } = useDownloadPDF();
 *   await downloadPDF('/api/v1/reportes/inventario/1/', 'inventario.pdf', { sede: 1 });
 */
export function useDownloadPDF() {
	const [isDownloading, setIsDownloading] = useState(false);

	/**
	 * @param {string} endpoint    URL completa o ruta relativa al axiosClient
	 * @param {string} filename    Nombre del archivo descargado (incluir .pdf)
	 * @param {object} [params={}] Query params opcionales para el GET
	 */
	const downloadPDF = useCallback(async (endpoint, filename = "reporte.pdf", params = {}) => {
		setIsDownloading(true);
		let objectUrl = null;

		try {
			const response = await axiosClient.get(endpoint, {
				responseType: "blob",
				params,
			});

			// Guardia: verificar que el servidor realmente devolvió un PDF
			// (en modo error el back puede responder JSON envuelto en blob)
			const contentType = response.headers?.["content-type"] ?? "";
			const isValidPDF  =
				contentType.includes("pdf") ||
				contentType.includes("octet-stream") ||
				response.data?.type === "application/pdf";

			if (!isValidPDF && response.data?.text) {
				// Intentar leer el mensaje de error del blob
				const rawText = await response.data.text();
				let detail = "El servidor no devolvió un archivo PDF.";
				try {
					detail = JSON.parse(rawText)?.detail ?? detail;
				} catch { /* noop */ }
				throw new Error(detail);
			}

			// Crear blob y object URL
			const blob = new Blob([response.data], { type: "application/pdf" });
			objectUrl  = URL.createObjectURL(blob);

			// Crear anchor efímero → click → eliminar del DOM
			const anchor      = document.createElement("a");
			anchor.href       = objectUrl;
			anchor.download   = filename;
			anchor.style.display = "none";
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);

			toast.success(`PDF descargado: ${filename}`);
		} catch (error) {
			const msg =
				error?.message ??
				error?.response?.data?.detail ??
				error?.response?.data?.message ??
				"Error al generar el reporte";
			toast.error(msg);
		} finally {
			// Liberar memoria del object URL siempre, incluso si hubo error
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			setIsDownloading(false);
		}
	}, []);

	return { downloadPDF, isDownloading };
}
