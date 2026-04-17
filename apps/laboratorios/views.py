from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.laboratorios.models import Laboratorio, Equipo
from apps.laboratorios.serializers import (
	LaboratorioListSerializer,
	LaboratorioDetalleSerializer,
	EquipoListSerializer,
	EquipoDetalleSerializer,
	EvaluacionInsituSerializer,
)
from apps.laboratorios.services import InventoryAnalyticsService
from apps.usuarios.models import AuditLog
from apps.usuarios.permissions import EsAdminOJefe, EsEncargadoActivos


class LaboratorioViewSet(ModelViewSet):
	"""ViewSet para gestión de laboratorios con analytics cacheados."""

	queryset = Laboratorio.objects.none()

	def get_queryset(self):
		queryset = Laboratorio.objects.select_related("unidad_academica")

		unidad_id = self.request.query_params.get("unidad_id")
		if unidad_id:
			queryset = queryset.filter(unidad_academica_id=unidad_id)

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update", "destroy"}:
			permission_classes = [EsAdminOJefe]
		elif self.action in {"analytics"}:
			permission_classes = [EsAdminOJefe]
		else:
			permission_classes = [IsAuthenticated]

		return [permission() for permission in permission_classes]

	def get_serializer_class(self):
		if self.action == "list":
			return LaboratorioListSerializer
		if self.action == "retrieve":
			return LaboratorioDetalleSerializer
		if self.action in {"create", "update", "partial_update"}:
			return LaboratorioListSerializer
		return LaboratorioDetalleSerializer

	@action(detail=True, methods=["get"], url_path="analytics")
	def analytics(self, request, pk=None):
		"""Obtiene analítica del laboratorio con caché Redis."""
		laboratorio = self.get_object()

		cache_key = f"analytics:{laboratorio.id}"
		data = cache.get(cache_key)

		if not data:
			service = InventoryAnalyticsService()
			data = {
				"deficit": service.calcular_deficit_laboratorio(laboratorio.id),
				"uso_equipos": [
					service.calcular_uso_equipo(e.id) for e in laboratorio.equipos.all()
				],
				"ratio_estudiantes": service.calcular_ratio_por_estudiantes(
					laboratorio.id
				),
				"excedentes": service.detectar_excedentes(laboratorio.id),
			}
			cache.set(cache_key, data, 3600)  # TTL 1 hora

		return Response(data, status=status.HTTP_200_OK)


class EquipoViewSet(ModelViewSet):
	"""ViewSet para gestión de equipos con evaluación in-situ."""

	queryset = Equipo.objects.none()

	def get_queryset(self):
		queryset = Equipo.objects.select_related("laboratorio", "evaluado_por")

		laboratorio_id = self.request.query_params.get("laboratorio_id")
		if laboratorio_id:
			queryset = queryset.filter(laboratorio_id=laboratorio_id)

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update", "destroy", "evaluacion_insitu"}:
			permission_classes = [EsEncargadoActivos]
		else:
			permission_classes = [IsAuthenticated]

		return [permission() for permission in permission_classes]

	def get_serializer_class(self):
		if self.action == "list":
			return EquipoListSerializer
		if self.action == "retrieve":
			return EquipoDetalleSerializer
		if self.action in {"create", "update", "partial_update", "evaluacion_insitu"}:
			return EquipoDetalleSerializer
		return EquipoDetalleSerializer

	@action(detail=True, methods=["patch"], url_path="evaluacion-insitu")
	def evaluacion_insitu(self, request, pk=None):
		"""Registra evaluación in-situ de equipo (cantidad buena/regular/mala)."""
		equipo = self.get_object()

		serializer = EvaluacionInsituSerializer(
			data=request.data, context={"equipo": equipo}
		)
		serializer.is_valid(raise_exception=True)

		# Capturar estado anterior completo
		datos_anteriores = EquipoDetalleSerializer(equipo).data

		# Actualizar cantidades y observaciones
		equipo.cantidad_buena = serializer.validated_data["cantidad_buena"]
		equipo.cantidad_regular = serializer.validated_data["cantidad_regular"]
		equipo.cantidad_mala = serializer.validated_data["cantidad_mala"]
		equipo.ubicacion_sala = serializer.validated_data.get(
			"ubicacion_sala", equipo.ubicacion_sala
		)
		equipo.observaciones = serializer.validated_data.get(
			"observaciones", equipo.observaciones
		)
		equipo.evaluado_en = timezone.now()
		equipo.evaluado_por = request.user
		equipo.save()

		# Invalidar caché de analytics del laboratorio
		cache.delete(f"analytics:{equipo.laboratorio_id}")

		# Registrar en AuditLog
		datos_nuevos = EquipoDetalleSerializer(equipo).data
		AuditLog.objects.create(
			tabla_afectada="Equipo",
			registro_id=equipo.id,
			accion=AuditLog.Accion.UPDATE,
			usuario=request.user,
			datos_anteriores=datos_anteriores,
			datos_nuevos=datos_nuevos,
		)

		return Response(
			EquipoDetalleSerializer(equipo).data, status=status.HTTP_200_OK
		)
