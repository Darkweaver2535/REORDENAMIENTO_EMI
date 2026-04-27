from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.evaluaciones.models import Evaluacion
from apps.evaluaciones.serializers import EvaluacionSerializer
from apps.usuarios.permissions import EsEncargadoActivos


class EvaluacionViewSet(viewsets.ModelViewSet):
    """ViewSet para gestión de evaluaciones in-situ de equipos."""

    queryset = Evaluacion.objects.select_related(
        "equipo", "evaluador", "laboratorio"
    ).all()
    serializer_class = EvaluacionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["equipo", "laboratorio", "evaluador"]
    ordering_fields = ["fecha", "equipo"]
    ordering = ["-fecha"]

    def get_permissions(self):
        if self.action in {"list", "retrieve", "ultima_por_equipo"}:
            return [IsAuthenticated()]
        return [EsEncargadoActivos()]

    def perform_create(self, serializer):
        evaluacion = serializer.save(evaluador=self.request.user)

        # Sincronizar el equipo con la evaluación
        equipo = evaluacion.equipo
        equipo.cantidad_buena = evaluacion.cantidad_bueno
        equipo.cantidad_regular = evaluacion.cantidad_regular
        equipo.cantidad_mala = evaluacion.cantidad_malo
        equipo.cantidad_total = evaluacion.total_unidades
        equipo.estatus_general = evaluacion.condicion_predominante
        equipo.observaciones = evaluacion.observaciones or equipo.observaciones
        equipo.evaluado_en = timezone.now()
        equipo.evaluado_por = self.request.user
        equipo.save()

    def perform_update(self, serializer):
        evaluacion = serializer.save(evaluador=self.request.user)

        # Sincronizar el equipo
        equipo = evaluacion.equipo
        equipo.cantidad_buena = evaluacion.cantidad_bueno
        equipo.cantidad_regular = evaluacion.cantidad_regular
        equipo.cantidad_mala = evaluacion.cantidad_malo
        equipo.cantidad_total = evaluacion.total_unidades
        equipo.estatus_general = evaluacion.condicion_predominante
        equipo.evaluado_en = timezone.now()
        equipo.evaluado_por = self.request.user
        equipo.save()

    @action(
        detail=False,
        methods=["get"],
        url_path=r"ultima-por-equipo/(?P<equipo_id>\d+)",
    )
    def ultima_por_equipo(self, request, equipo_id=None):
        """GET /api/v1/evaluaciones/ultima-por-equipo/:equipo_id/"""
        evaluacion = Evaluacion.objects.filter(equipo_id=equipo_id).first()
        if not evaluacion:
            return Response(None, status=status.HTTP_204_NO_CONTENT)
        return Response(EvaluacionSerializer(evaluacion).data)
