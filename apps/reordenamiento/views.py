from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.laboratorios.models import Laboratorio
from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.reordenamiento.serializers import (
	ReordenamientoListSerializer,
	ReordenamientoDetalleSerializer,
	CrearReordenamientoSerializer,
)
from apps.reordenamiento.services import ReordenamientoService
from apps.usuarios.permissions import EsAdminOJefe, EsEncargadoActivos, EsDecanoOAdmin


class ReordenamientoViewSet(ModelViewSet):
	"""ViewSet para el flujo completo de reordenamiento inter-sede."""

	queryset = Reordenamiento.objects.none()

	def get_queryset(self):
		queryset = Reordenamiento.objects.select_related(
			"equipo",
			"laboratorio_origen",
			"laboratorio_destino",
			"autorizado_por",
			"ejecutado_por",
		)

		# Filtrar por laboratorio origen si viene en query_params
		laboratorio_origen_id = self.request.query_params.get("laboratorio_origen_id")
		if laboratorio_origen_id:
			queryset = queryset.filter(laboratorio_origen_id=laboratorio_origen_id)

		# Filtrar por laboratorio destino si viene en query_params
		laboratorio_destino_id = self.request.query_params.get("laboratorio_destino_id")
		if laboratorio_destino_id:
			queryset = queryset.filter(laboratorio_destino_id=laboratorio_destino_id)

		# Filtrar por estado si viene en query_params
		estado = self.request.query_params.get("estado")
		if estado:
			queryset = queryset.filter(estado=estado)

		# RESTRICCIÓN: si el usuario es encargado_activos, solo ve sus reordenamientos
		user = self.request.user
		if hasattr(user, "rol") and (user.rol or "").strip().lower() == "encargado_activos":
			# Solo ve reordenamientos donde origen o destino pertenecen a su unidad_academica
			if hasattr(user, "laboratorio") and user.laboratorio:
				unidad_id = user.laboratorio.unidad_academica_id
				queryset = queryset.filter(
					Q(laboratorio_origen__unidad_academica_id=unidad_id)
					| Q(laboratorio_destino__unidad_academica_id=unidad_id)
				)
			else:
				# Si no tiene laboratorio asignado, no ve nada
				queryset = queryset.none()

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update", "destroy"}:
			permission_classes = [EsAdminOJefe]
		elif self.action in {"autorizar"}:
			permission_classes = [EsDecanoOAdmin]
		elif self.action in {"ejecutar"}:
			permission_classes = [EsEncargadoActivos]
		elif self.action in {"comparativa_sedes"}:
			permission_classes = [EsAdminOJefe]
		else:
			permission_classes = [IsAuthenticated]

		return [permission() for permission in permission_classes]

	def get_serializer_class(self):
		if self.action == "list":
			return ReordenamientoListSerializer
		if self.action == "retrieve":
			return ReordenamientoDetalleSerializer
		if self.action in {"create", "update", "partial_update"}:
			return CrearReordenamientoSerializer
		return ReordenamientoDetalleSerializer

	def perform_create(self, serializer):
		"""Delega la creación a ReordenamientoService."""
		ReordenamientoService.crear_solicitud(
			**serializer.validated_data, usuario_solicitante=self.request.user
		)

	@action(detail=True, methods=["post"], url_path="autorizar")
	def autorizar(self, request, pk=None):
		"""Autoriza un reordenamiento para ejecución."""
		reord = self.get_object()

		if reord.estado != Reordenamiento.Estado.PENDIENTE:
			return Response(
				{
					"detail": "El reordenamiento debe estar en estado pendiente para autorizar.",
					"estado_actual": reord.estado,
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		ReordenamientoService.autorizar(reord.id, request.user)

		return Response(
			{
				"estado": Reordenamiento.Estado.AUTORIZADO,
				"mensaje": "Reordenamiento autorizado. PDF en generación...",
			},
			status=status.HTTP_200_OK,
		)

	@action(detail=True, methods=["post"], url_path="ejecutar")
	def ejecutar(self, request, pk=None):
		"""Ejecuta un reordenamiento autorizado (traslado de equipo)."""
		reord = self.get_object()

		if reord.estado != Reordenamiento.Estado.AUTORIZADO:
			return Response(
				{
					"detail": "El reordenamiento debe estar autorizado para ejecutar.",
					"estado_actual": reord.estado,
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		ReordenamientoService.ejecutar_traslado(reord.id, request.user)

		return Response(
			{
				"estado": Reordenamiento.Estado.EJECUTADO,
				"mensaje": "Traslado registrado. Inventario actualizado.",
			},
			status=status.HTTP_200_OK,
		)

	@action(detail=False, methods=["get"], url_path="comparativa-sedes")
	def comparativa_sedes(self, request):
		"""Compara disponibilidad de equipos por nombre en todas las sedes."""
		nombre_equipo = request.query_params.get("nombre_equipo")

		if not nombre_equipo:
			return Response(
				{
					"detail": "Parámetro 'nombre_equipo' requerido.",
					"ejemplo": "/api/reordenamiento/comparativa-sedes/?nombre_equipo=Microscopio",
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		service = InventoryAnalyticsService()
		data = service.comparar_sedes_para_equipo(nombre_equipo)

		return Response(data, status=status.HTTP_200_OK)
