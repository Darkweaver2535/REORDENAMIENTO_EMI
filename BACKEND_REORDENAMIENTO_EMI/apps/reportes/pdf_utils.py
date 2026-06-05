"""
Utilidades para construir PDFs institucionales con ReportLab.
Se usan en todas las vistas de reportes para mantener un estilo consistente.

ReportLab es la única librería de generación de PDF del proyecto: tanto los
reportes de las vistas como el documento de reordenamiento (generado async en
Celery) se construyen aquí para mantener un estilo unificado.
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as _canvas

# ── Paleta EMI ──────────────────────────────────────────────────────────────
COLOR_PRIMARIO = colors.HexColor("#003366")  # Azul institucional
COLOR_SECUNDARIO = colors.HexColor("#0066CC")
COLOR_FILA_PAR = colors.HexColor("#EEF4FB")
COLOR_ENCABEZADO = colors.HexColor("#003366")
COLOR_LINEA = colors.HexColor("#CCDDEE")

ANCHO, ALTO = A4
MARGEN = 50


def dibujar_encabezado(canvas, titulo, subtitulo=""):
    """Dibuja el encabezado institucional y retorna la posición Y restante."""
    # Franja azul superior
    canvas.setFillColor(COLOR_PRIMARIO)
    canvas.rect(0, ALTO - 70, ANCHO, 70, fill=True, stroke=False)

    # Título en blanco
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(MARGEN, ALTO - 35, "EMI — Sistema de Gestión de Laboratorios")
    canvas.setFont("Helvetica", 11)
    canvas.drawString(MARGEN, ALTO - 52, titulo)

    if subtitulo:
        canvas.setFont("Helvetica", 9)
        canvas.drawString(MARGEN, ALTO - 64, subtitulo)

    # Línea decorativa
    canvas.setStrokeColor(COLOR_SECUNDARIO)
    canvas.setLineWidth(2)
    canvas.line(MARGEN, ALTO - 75, ANCHO - MARGEN, ALTO - 75)

    return ALTO - 95  # Y de inicio del contenido


def dibujar_fila_tabla(canvas, y, valores, x_positions, anchos, es_encabezado=False, es_par=True):
    """Dibuja una fila de tabla con fondo alternado."""
    alto_fila = 16

    # Fondo de fila
    if es_encabezado:
        canvas.setFillColor(COLOR_ENCABEZADO)
    elif es_par:
        canvas.setFillColor(COLOR_FILA_PAR)
    else:
        canvas.setFillColor(colors.white)

    canvas.rect(MARGEN, y - 4, ANCHO - MARGEN * 2, alto_fila, fill=True, stroke=False)

    # Texto
    canvas.setFillColor(colors.white if es_encabezado else colors.black)
    canvas.setFont("Helvetica-Bold" if es_encabezado else "Helvetica", 8)

    for i, valor in enumerate(valores):
        max_chars = max(1, anchos[i] // 6)
        texto = str(valor)[:max_chars]
        canvas.drawString(x_positions[i] + 3, y, texto)

    # Línea separadora
    canvas.setStrokeColor(COLOR_LINEA)
    canvas.setLineWidth(0.3)
    canvas.line(MARGEN, y - 4, ANCHO - MARGEN, y - 4)

    return y - alto_fila


def dibujar_pie(canvas, numero_pagina):
    """Dibuja el pie de página con número de página."""
    canvas.setFillColor(COLOR_PRIMARIO)
    canvas.rect(0, 0, ANCHO, 25, fill=True, stroke=False)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(MARGEN, 8, "Documento generado automáticamente — Confidencial")
    canvas.drawRightString(ANCHO - MARGEN, 8, f"Página {numero_pagina}")


def construir_pdf_reordenamiento(reordenamiento, autorizador_nombre=None, fecha_generacion=None):
    """Construye el PDF del acta de un reordenamiento y devuelve los bytes.

    Centraliza en ReportLab la generación que antes hacía WeasyPrint en
    apps/reordenamiento/tasks.py, eliminando esa dependencia del proyecto.
    """
    buffer = BytesIO()
    pdf = _canvas.Canvas(buffer, pagesize=A4)

    tipo = (
        reordenamiento.get_tipo_movimiento_display()
        if hasattr(reordenamiento, "get_tipo_movimiento_display")
        else reordenamiento.tipo_movimiento
    )
    y = dibujar_encabezado(pdf, "Acta de Reordenamiento", f"Movimiento: {tipo}")

    equipo = getattr(reordenamiento, "equipo", None)
    origen = getattr(reordenamiento, "laboratorio_origen", None)
    destino = getattr(reordenamiento, "laboratorio_destino", None)
    documento = reordenamiento.numero_documento or reordenamiento.resolucion_numero or "N/A"

    filas = [
        ("N.º de reordenamiento", str(reordenamiento.id)),
        ("Equipo", getattr(equipo, "nombre", "N/A")),
        ("Laboratorio origen", getattr(origen, "nombre", "N/A")),
        ("Laboratorio destino", getattr(destino, "nombre", "N/A")),
        ("Cantidad trasladada", str(reordenamiento.cantidad_trasladada)),
        ("Documento / resolución", documento),
        ("Fecha de autorización", str(reordenamiento.fecha_autorizacion or "N/A")),
        ("Autorizado por", autorizador_nombre or "N/A"),
    ]
    if fecha_generacion:
        filas.append(("Generado el", str(fecha_generacion)))

    pdf.setFont("Helvetica", 10)
    for etiqueta, valor in filas:
        pdf.setFillColor(COLOR_PRIMARIO)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(MARGEN, y, f"{etiqueta}:")
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(MARGEN + 160, y, valor)
        y -= 20

    dibujar_pie(pdf, 1)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
