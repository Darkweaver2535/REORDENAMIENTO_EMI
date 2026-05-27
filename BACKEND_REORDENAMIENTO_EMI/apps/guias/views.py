from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.guias.models import Guia
from apps.guias.serializers import (
	GuiaCrearSerializer,
	GuiaDetalleSerializer,
	GuiaListSerializer,
	EquipoRequeridoListSerializer,
)
from apps.laboratorios.models import EquipoRequeridoPorGuia
from apps.usuarios.models import AuditLog
from apps.usuarios.permissions import EsAdminOJefe, PuedeGestionarGuias


class GuiaViewSet(ModelViewSet):
	queryset = Guia.objects.none()

	def get_queryset(self):
		queryset = Guia.objects.select_related("asignatura")

		asignatura_id = self.request.query_params.get("asignatura_id")
		if asignatura_id:
			queryset = queryset.filter(asignatura_id=asignatura_id)

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update"}:
			permission_classes = [PuedeGestionarGuias]
		elif self.action in {"destroy"}:
			permission_classes = [EsAdminOJefe]
		else:
			permission_classes = [IsAuthenticated]

		return [permission() for permission in permission_classes]

	def get_serializer_class(self):
		if self.action == "list":
			return GuiaListSerializer
		if self.action == "retrieve":
			return GuiaDetalleSerializer
		if self.action in {"create", "update", "partial_update"}:
			return GuiaCrearSerializer
		return GuiaDetalleSerializer

	def perform_create(self, serializer):
		guia = serializer.save()
		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=guia.id,
			accion=AuditLog.Accion.CREATE,
			usuario=self.request.user,
			datos_nuevos={
				"titulo": guia.titulo,
				"asignatura_id": guia.asignatura_id,
			},
		)


class EquipoRequeridoViewSet(ModelViewSet):
	"""ViewSet para gestionar equipos requeridos por guías (CRUD completo)."""

	serializer_class = EquipoRequeridoListSerializer

	def get_queryset(self):
		queryset = EquipoRequeridoPorGuia.objects.select_related("guia", "equipo")

		guia_id = self.request.query_params.get("guia_id")
		if guia_id:
			queryset = queryset.filter(guia_id=guia_id)

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update", "destroy"}:
			permission_classes = [EsAdminOJefe]
		else:
			permission_classes = [IsAuthenticated]

		return [permission() for permission in permission_classes]
