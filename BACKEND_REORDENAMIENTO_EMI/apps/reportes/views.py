from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.laboratorios.models import Equipo, Laboratorio
from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.reportes.pdf_utils import (
    ANCHO, ALTO, MARGEN,
    dibujar_encabezado,
    dibujar_fila_tabla,
    dibujar_pie,
)


# ── REPORTE 1: Inventario de laboratorio ────────────────────────────────────

class ReporteInventarioLaboratorioView(APIView):
    """
    GET /api/v1/reportes/inventario-laboratorio/{pk}/
    Genera un PDF con el inventario completo de equipos de un laboratorio.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        laboratorio = get_object_or_404(
            Laboratorio.objects.select_related("unidad_academica"), pk=pk
        )
        equipos = (
            Equipo.objects.filter(laboratorio=laboratorio)
            .order_by("codigo_activo")
        )

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        numero_pagina = 1

        subtitulo = (
            f"Unidad Académica: {laboratorio.unidad_academica.nombre}  |  "
            f"Sala: {laboratorio.sala}  |  "
            f"Fecha: {timezone.now().strftime('%d/%m/%Y %H:%M')}"
        )
        y = dibujar_encabezado(p, f"Inventario de Equipos — {laboratorio.nombre}", subtitulo)

        # ── Cabecera de tabla ────────────────────────────────────────────────
        headers  = ["Código Activo", "Nombre del Equipo",       "Total", "Buenos", "Reg.", "Malos", "Estado"]
        x_pos    = [MARGEN,          MARGEN + 90,               330,     370,      410,    450,     490]
        anchos   = [88,              135,                        35,      35,       35,     35,      70]

        y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

        # ── Filas de datos ───────────────────────────────────────────────────
        for idx, equipo in enumerate(equipos):
            if y < 40:
                dibujar_pie(p, numero_pagina)
                p.showPage()
                numero_pagina += 1
                y = dibujar_encabezado(p, f"Inventario — {laboratorio.nombre} (cont.)")
                y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

            fila = [
                equipo.codigo_activo,
                equipo.nombre[:30],
                equipo.cantidad_total,
                equipo.cantidad_buena,
                equipo.cantidad_regular,
                equipo.cantidad_mala,
                equipo.get_estatus_general_display(),
            ]
            y = dibujar_fila_tabla(p, y, fila, x_pos, anchos, es_par=(idx % 2 == 0))

        dibujar_pie(p, numero_pagina)
        p.save()
        buffer.seek(0)

        filename = (
            f"inventario_{laboratorio.nombre.replace(' ', '_')}_"
            f"{timezone.now().strftime('%Y%m%d')}.pdf"
        )
        return FileResponse(buffer, as_attachment=True, filename=filename,
                            content_type="application/pdf")


# ── REPORTE 2: Reordenamientos por rango de fechas ──────────────────────────

class ReporteReordenamientosView(APIView):
    """
    GET /api/v1/reportes/reordenamientos/
    Filtros opcionales: ?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD&estado=pendiente
    Genera un PDF con el listado de reordenamientos del período.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        fecha_inicio = request.query_params.get("fecha_inicio")
        fecha_fin = request.query_params.get("fecha_fin")
        estado = request.query_params.get("estado")

        queryset = Reordenamiento.objects.select_related(
            "equipo",
            "laboratorio_origen__unidad_academica",
            "laboratorio_destino__unidad_academica",
            "autorizado_por",
        ).order_by("-created_at")

        if fecha_inicio:
            queryset = queryset.filter(created_at__date__gte=fecha_inicio)
        if fecha_fin:
            queryset = queryset.filter(created_at__date__lte=fecha_fin)
        if estado:
            queryset = queryset.filter(estado=estado)

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        numero_pagina = 1

        rango = ""
        if fecha_inicio or fecha_fin:
            rango = f"Período: {fecha_inicio or '—'} → {fecha_fin or '—'}"
        subtitulo = f"{rango}  |  Generado: {timezone.now().strftime('%d/%m/%Y %H:%M')}"

        y = dibujar_encabezado(p, "Reporte de Reordenamientos", subtitulo)

        # ── Cabecera de tabla ────────────────────────────────────────────────
        headers = ["Fecha",      "Equipo",       "Origen",       "Destino",      "Cant.", "Estado",    "Resolución"]
        x_pos   = [MARGEN,       MARGEN + 55,    MARGEN + 155,   MARGEN + 255,   355,     395,         450]
        anchos  = [52,           95,             95,             95,             35,      50,          100]

        y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

        # ── Filas de datos ───────────────────────────────────────────────────
        for idx, reord in enumerate(queryset):
            if y < 40:
                dibujar_pie(p, numero_pagina)
                p.showPage()
                numero_pagina += 1
                y = dibujar_encabezado(p, "Reporte de Reordenamientos (cont.)")
                y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

            fila = [
                reord.created_at.strftime("%d/%m/%Y"),
                reord.equipo.nombre[:18],
                reord.laboratorio_origen.nombre[:18],
                reord.laboratorio_destino.nombre[:18],
                reord.cantidad_trasladada,
                reord.get_estado_display(),
                reord.resolucion_numero,
            ]
            y = dibujar_fila_tabla(p, y, fila, x_pos, anchos, es_par=(idx % 2 == 0))

        dibujar_pie(p, numero_pagina)
        p.save()
        buffer.seek(0)

        filename = f"reordenamientos_{timezone.now().strftime('%Y%m%d_%H%M')}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename,
                            content_type="application/pdf")


# ── REPORTE 3: Comparativa de disponibilidad de equipos entre unidades académicas ──

class ReporteComparativaSedesView(APIView):
    """
    GET /api/v1/reportes/comparativa-sedes/?nombre_equipo=Microscopio
    Genera un PDF comparando disponibilidad vs. demanda de un equipo en todas las unidades académicas.
    El parámetro ?nombre_equipo es requerido.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        nombre_equipo = request.query_params.get("nombre_equipo", "").strip()

        from rest_framework.response import Response
        from rest_framework import status as drf_status

        if not nombre_equipo:
            return Response(
                {"detail": "El parámetro 'nombre_equipo' es requerido."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        datos = InventoryAnalyticsService.comparar_sedes_para_equipo(nombre_equipo)

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        numero_pagina = 1

        subtitulo = (
            f"Equipo buscado: \"{nombre_equipo}\"  |  "
            f"Generado: {timezone.now().strftime('%d/%m/%Y %H:%M')}"
        )
        y = dibujar_encabezado(p, "Comparativa de Disponibilidad por Unidad Académica", subtitulo)

        # ── Cabecera de tabla ────────────────────────────────────────────────
        headers = ["Unidad Acad.", "Laboratorio",  "Disponible", "Requerido", "Déficit", "Ratio/Est."]
        x_pos   = [MARGEN,        MARGEN + 120,   295,          355,         415,       470]
        anchos  = [115,           130,            55,           55,          55,        80]

        y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

        # ── Filas de datos ───────────────────────────────────────────────────
        for idx, fila_data in enumerate(datos):
            if y < 40:
                dibujar_pie(p, numero_pagina)
                p.showPage()
                numero_pagina += 1
                y = dibujar_encabezado(p, "Comparativa de Unidades Académicas (cont.)")
                y = dibujar_fila_tabla(p, y, headers, x_pos, anchos, es_encabezado=True)

            deficit = fila_data.get("deficit", 0)
            fila = [
                fila_data.get("sede") or "—",
                fila_data.get("laboratorio", "")[:22],
                fila_data.get("cantidad_disponible", 0),
                fila_data.get("cantidad_requerida", 0),
                deficit,
                fila_data.get("ratio", 0),
            ]
            y = dibujar_fila_tabla(p, y, fila, x_pos, anchos, es_par=(idx % 2 == 0))

        dibujar_pie(p, numero_pagina)
        p.save()
        buffer.seek(0)

        nombre_archivo = nombre_equipo.replace(" ", "_").lower()
        filename = f"comparativa_unidades_{nombre_archivo}_{timezone.now().strftime('%Y%m%d')}.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename,
                            content_type="application/pdf")

