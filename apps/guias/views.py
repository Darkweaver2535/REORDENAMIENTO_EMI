# App: guias | Archivo: views.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear GuiaViewSet con control de acceso estricto por rol y estado:
#
# class GuiaViewSet(ModelViewSet):
#
# 1. get_queryset():
#    - Si usuario.rol in ['estudiante', 'docente']:
#      SOLO retornar guías con estado='publicado'
#    - Si usuario.rol in ['admin', 'jefe', 'decano']:
#      Retornar TODAS las guías (todos los estados)
#    - Siempre filtrar por asignatura_id si viene en query_params
#    - Usar select_related('asignatura', 'aprobado_por')
#
# 2. get_permissions():
#    - list, retrieve: IsAuthenticated (todos pueden ver lo publicado)
#    - create, update, partial_update: PuedeGestionarGuias (solo admin/jefe)
#    - destroy: EsAdminOJefe
#
# 3. get_serializer_class():
#    - Para list: GuiaListSerializer
#    - Para retrieve: GuiaDetalleSerializer
#    - Para create/update: GuiaCrearSerializer
#
# 4. @action(detail=True, methods=['post'], url_path='solicitar-aprobacion')
#    solicitar_aprobacion(request, pk): cambia estado a 'pendiente'
#    Requiere: PuedeGestionarGuias
#
# 5. @action(detail=True, methods=['post'], url_path='publicar')
#    publicar(request, pk): cambia estado a 'publicado', requiere resolucion_numero
#    Requiere: EsDecanoOAdmin
#    Valida: guia.puede_publicarse() == True
#    Registra en AuditLog accion='PUBLISH'
#
# 6. @action(detail=True, methods=['post'], url_path='rechazar')
#    rechazar(request, pk): regresa a 'borrador', guarda motivo_rechazo
#    Requiere: EsDecanoOAdmin

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
)
from apps.usuarios.models import AuditLog
from apps.usuarios.permissions import EsAdminOJefe, EsDecanoOAdmin, PuedeGestionarGuias


class GuiaViewSet(ModelViewSet):
	queryset = Guia.objects.none()

	def get_queryset(self):
		user = self.request.user
		rol = (getattr(user, "rol", "") or "").strip().lower()

		queryset = Guia.objects.select_related("asignatura", "aprobado_por")

		if rol in {"estudiante", "docente"}:
			queryset = queryset.filter(estado=Guia.Estado.PUBLICADO)
		elif rol in {"admin", "jefe", "decano"}:
			pass
		else:
			queryset = queryset.none()

		asignatura_id = self.request.query_params.get("asignatura_id")
		if asignatura_id:
			queryset = queryset.filter(asignatura_id=asignatura_id)

		return queryset

	def get_permissions(self):
		if self.action in {"list", "retrieve"}:
			permission_classes = [IsAuthenticated]
		elif self.action in {"create", "update", "partial_update", "solicitar_aprobacion"}:
			permission_classes = [PuedeGestionarGuias]
		elif self.action in {"destroy"}:
			permission_classes = [EsAdminOJefe]
		elif self.action in {"publicar", "rechazar"}:
			permission_classes = [EsDecanoOAdmin]
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

	@action(detail=True, methods=["post"], url_path="solicitar-aprobacion")
	def solicitar_aprobacion(self, request, pk=None):
		guia = self.get_object()
		guia.estado = Guia.Estado.PENDIENTE
		guia.save(update_fields=["estado", "updated_at"])
		return Response({"detail": "Guia enviada a aprobacion.", "estado": guia.estado})

	@action(detail=True, methods=["post"], url_path="publicar")
	def publicar(self, request, pk=None):
		guia = self.get_object()

		if not guia.puede_publicarse():
			return Response(
				{
					"detail": (
						"La guia no puede publicarse. Debe estar en estado aprobado y "
						"tener resolucion_numero."
					)
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		guia.estado = Guia.Estado.PUBLICADO
		guia.aprobado_por = request.user
		guia.save(update_fields=["estado", "aprobado_por", "updated_at"])

		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=guia.id,
			accion=AuditLog.Accion.PUBLISH,
			usuario=request.user,
			datos_nuevos={
				"estado": guia.estado,
				"resolucion_numero": guia.resolucion_numero,
			},
		)

		return Response({"detail": "Guia publicada correctamente.", "estado": guia.estado})

	@action(detail=True, methods=["post"], url_path="rechazar")
	def rechazar(self, request, pk=None):
		guia = self.get_object()
		motivo_rechazo = request.data.get("motivo_rechazo", "")

		guia.estado = Guia.Estado.BORRADOR
		guia.motivo_rechazo = motivo_rechazo
		guia.save(update_fields=["estado", "motivo_rechazo", "updated_at"])

		return Response(
			{
				"detail": "Guia rechazada y devuelta a borrador.",
				"estado": guia.estado,
				"motivo_rechazo": guia.motivo_rechazo,
			}
		)
