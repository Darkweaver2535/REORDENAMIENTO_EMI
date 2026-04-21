from django.db.models import Sum
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
        )
        total_equipos = totales["total"] or 0
        total_malos = totales["malos"] or 0
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

        return Response(
            {
                "total_guias_publicadas": total_guias,
                "total_equipos": total_equipos,
                "equipos_malos_porcentaje": pct_malos,
                "laboratorios_activos": labs_activos,
                "reordenamientos_pendientes": pendientes,
                # Placeholder: implementación futura con horarios de prácticas
                "proximas_practicas": [],
            }
        )
