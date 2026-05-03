from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.mantenimientos.models import RegistroMantenimiento
from apps.mantenimientos.serializers import RegistroMantenimientoSerializer
from apps.usuarios.permissions import EsAdminOJefe, EsEncargadoActivos


class RegistroMantenimientoViewSet(viewsets.ModelViewSet):
	"""CRUD de bitácora de mantenimiento por equipo."""

	queryset = RegistroMantenimiento.objects.select_related(
		"equipo", "realizado_por"
	).all()
	serializer_class = RegistroMantenimientoSerializer
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
	filterset_fields = ["equipo", "tipo", "estado"]
	ordering_fields = ["fecha_realizacion"]

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			return [IsAuthenticated()]
		return [EsEncargadoActivos()]

	def perform_create(self, serializer):
		serializer.save(realizado_por=self.request.user)

	def perform_update(self, serializer):
		serializer.save(realizado_por=self.request.user)
