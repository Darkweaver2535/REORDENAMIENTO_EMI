from django.db import models
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.guias.models import Guia
from apps.laboratorios.models import Equipo, Laboratorio
from apps.reordenamiento.models import Reordenamiento


class DashboardMetricasView(APIView):
    """
    GET /api/v1/dashboard/metricas/
    Retorna las métricas principales para el panel de control.
    No requiere parámetros; todos los datos son agregados globales.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # ── Guías publicadas ──────────────────────────────────────────────────
        total_guias = Guia.objects.filter(estado=Guia.Estado.PUBLICADO).count()

        # ── Equipos: totales y en mal estado ─────────────────────────────────
        totales = Equipo.objects.aggregate(
            total=Sum("cantidad_total"),
            malos=Sum("cantidad_mala"),
            buenos=Sum("cantidad_buena"),
            regulares=Sum("cantidad_regular"),
        )
        total_equipos = totales["total"] or 0
        total_malos = totales["malos"] or 0
        total_buenos = totales["buenos"] or 0
        total_regulares = totales["regulares"] or 0
        pct_malos = (
            round((total_malos / total_equipos) * 100, 1)
            if total_equipos > 0
            else 0
        )

        # ── Laboratorios activos ──────────────────────────────────────────────
        labs_activos = Laboratorio.objects.filter(is_active=True).count()

        # ── Reordenamientos pendientes ────────────────────────────────────────
        pendientes = Reordenamiento.objects.filter(
            estado=Reordenamiento.Estado.PENDIENTE
        ).count()

        # ── Equipos por Sede (para gráfico de barras) ─────────────────────────
        equipos_por_sede = (
            Equipo.objects.values(
                sede=models.F("laboratorio__unidad_academica__abreviacion"),
            )
            .annotate(
                total=Sum("cantidad_total"),
                buenos=Sum("cantidad_buena"),
                regulares=Sum("cantidad_regular"),
                malos=Sum("cantidad_mala"),
            )
            .order_by("sede")
        )

        # ── Estado global de equipos (para gráfico de dona) ───────────────────
        estado_equipos = [
            {"name": "Bueno", "value": total_buenos},
            {"name": "Regular", "value": total_regulares},
            {"name": "Malo", "value": total_malos},
        ]

        # ── Reordenamientos por mes (últimos 6 meses, para gráfico de línea) ──
        hace_6_meses = timezone.now() - timezone.timedelta(days=180)
        reordenamientos_por_mes = (
            Reordenamiento.objects.filter(created_at__gte=hace_6_meses)
            .annotate(mes=TruncMonth("created_at"))
            .values("mes")
            .annotate(traslados=Count("id"))
            .order_by("mes")
        )

        # Formatear a nombres cortos de mes en español
        MESES_ES = [
            "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
            "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
        ]
        reordenamientos_mensual = [
            {
                "mes": MESES_ES[r["mes"].month] if r["mes"] else "—",
                "traslados": r["traslados"],
            }
            for r in reordenamientos_por_mes
        ]

        return Response(
            {
                "total_guias_publicadas": total_guias,
                "total_equipos": total_equipos,
                "equipos_malos_porcentaje": pct_malos,
                "laboratorios_activos": labs_activos,
                "reordenamientos_pendientes": pendientes,
                # Datos para gráficos
                "equipos_por_sede": list(equipos_por_sede),
                "estado_equipos": estado_equipos,
                "reordenamientos_mensual": reordenamientos_mensual,
                # Placeholder: implementación futura con horarios de prácticas
                "proximas_practicas": [],
            }
        )
