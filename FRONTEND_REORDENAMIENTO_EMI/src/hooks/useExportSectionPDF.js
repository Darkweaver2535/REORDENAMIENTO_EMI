// src/hooks/useExportSectionPDF.js
import { useCallback, useState } from "react";
import toast from "react-hot-toast";

/**
 * Hook to export a DOM section (including Recharts SVGs) to PDF.
 * Usage:
 *   const { exportRef, exportPDF, isExporting } = useExportSectionPDF();
 *   <div ref={exportRef}>...charts...</div>
 *   <button onClick={() => exportPDF("reporte.pdf")}>Export</button>
 */
export function useExportSectionPDF() {
	const [isExporting, setIsExporting] = useState(false);
	const [exportRef, setExportRef] = useState(null);

	const refCallback = useCallback((node) => {
		setExportRef(node);
	}, []);

	const exportPDF = useCallback(async (filename = "reporte.pdf", title = "") => {
		if (!exportRef) { toast.error("No hay contenido para exportar"); return; }
		setIsExporting(true);
		const toastId = toast.loading("Generando PDF con gráficos...");

		try {
			const html2canvas = (await import("html2canvas")).default;
			const { jsPDF } = await import("jspdf");

			const canvas = await html2canvas(exportRef, {
				scale: 2,
				useCORS: true,
				backgroundColor: "#ffffff",
				logging: false,
				windowWidth: 1200,
			});

			const imgData = canvas.toDataURL("image/png");
			const pdf = new jsPDF("p", "mm", "letter");
			const pageW = pdf.internal.pageSize.getWidth();
			const pageH = pdf.internal.pageSize.getHeight();
			const margin = 12;
			const usableW = pageW - margin * 2;

			// Header
			pdf.setFillColor(0, 43, 94);
			pdf.rect(0, 0, pageW, 28, "F");
			pdf.setTextColor(255, 255, 255);
			pdf.setFontSize(16);
			pdf.setFont(undefined, "bold");
			pdf.text(title || "Reporte SGL — EMI", margin, 18);
			pdf.setFontSize(9);
			pdf.setFont(undefined, "normal");
			pdf.text(`Generado: ${new Date().toLocaleString("es-BO")}`, pageW - margin, 18, { align: "right" });

			// Image
			const imgW = usableW;
			const imgH = (canvas.height * imgW) / canvas.width;
			let y = 34;
			let remainH = imgH;
			let srcY = 0;

			while (remainH > 0) {
				const sliceH = Math.min(remainH, pageH - y - margin);
				const sliceCanvasH = (sliceH / imgH) * canvas.height;

				const sliceCanvas = document.createElement("canvas");
				sliceCanvas.width = canvas.width;
				sliceCanvas.height = sliceCanvasH;
				const ctx = sliceCanvas.getContext("2d");
				ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvasH, 0, 0, canvas.width, sliceCanvasH);

				const sliceImg = sliceCanvas.toDataURL("image/png");
				pdf.addImage(sliceImg, "PNG", margin, y, imgW, sliceH);

				remainH -= sliceH;
				srcY += sliceCanvasH;

				if (remainH > 0) {
					pdf.addPage();
					y = margin;
				}
			}

			// Footer on last page
			pdf.setTextColor(150, 150, 150);
			pdf.setFontSize(8);
			pdf.text("Sistema de Gestión de Laboratorios — Escuela Militar de Ingeniería", pageW / 2, pageH - 6, { align: "center" });

			pdf.save(filename);
			toast.success(`PDF descargado: ${filename}`, { id: toastId });
		} catch (err) {
			console.error("Error exportando PDF:", err);
			toast.error("Error al generar el PDF", { id: toastId });
		} finally {
			setIsExporting(false);
		}
	}, [exportRef]);

	return { exportRef: refCallback, exportPDF, isExporting };
}
