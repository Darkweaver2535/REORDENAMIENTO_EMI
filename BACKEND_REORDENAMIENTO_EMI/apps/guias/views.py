from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.guias.models import Guia
from apps.guias.serializers import (
	GuiaCambioEstadoSerializer,
	GuiaCrearSerializer,
	GuiaDetalleSerializer,
	GuiaListSerializer,
	EquipoRequeridoListSerializer,
)
from apps.laboratorios.models import EquipoRequeridoPorGuia
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

	def perform_create(self, serializer):
		guia = serializer.save()
		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=guia.id,
			accion=AuditLog.Accion.CREATE,
			usuario=self.request.user,
			datos_nuevos={
				"titulo": guia.titulo,
				"estado": guia.estado,
				"asignatura_id": guia.asignatura_id,
			},
		)

	@action(detail=True, methods=["post"], url_path="solicitar-aprobacion")
	def solicitar_aprobacion(self, request, pk=None):
		guia = self.get_object()

		if guia.estado != Guia.Estado.BORRADOR:
			return Response(
				{
					"detail": "La guía debe estar en estado borrador para solicitar aprobación.",
					"estado_actual": guia.estado,
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		guia.estado = Guia.Estado.PENDIENTE
		guia.save(update_fields=["estado", "updated_at"])

		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=guia.id,
			accion=AuditLog.Accion.UPDATE,
			usuario=request.user,
			datos_anteriores={"estado": Guia.Estado.BORRADOR},
			datos_nuevos={"estado": guia.estado},
		)

		return Response(
			{"detail": "Guía enviada a revisión.", "estado": guia.estado},
			status=status.HTTP_200_OK,
		)

	@action(detail=True, methods=["post"], url_path="publicar")
	def publicar(self, request, pk=None):
		guia = self.get_object()

		serializer = GuiaCambioEstadoSerializer(data=request.data, context={"action": "publicar"})
		serializer.is_valid(raise_exception=True)

		if not guia.puede_publicarse():
			return Response(
				{
					"detail": "La guía no puede publicarse. Debe estar en estado aprobado y tener resolución.",
					"estado_actual": guia.estado,
					"tiene_resolucion": bool(guia.resolucion_numero),
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		guia.estado = Guia.Estado.PUBLICADO
		guia.resolucion_numero = serializer.validated_data.get("resolucion_numero") or guia.resolucion_numero
		guia.aprobado_por = request.user
		guia.save(update_fields=["estado", "resolucion_numero", "aprobado_por", "updated_at"])

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

		return Response(
			{"detail": "Guía publicada exitosamente.", "estado": guia.estado},
			status=status.HTTP_200_OK,
		)

	@action(detail=True, methods=["post"], url_path="rechazar")
	def rechazar(self, request, pk=None):
		guia = self.get_object()

		if guia.estado != Guia.Estado.PENDIENTE:
			return Response(
				{
					"detail": "La guía debe estar en estado pendiente para rechazo.",
					"estado_actual": guia.estado,
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		motivo_rechazo = request.data.get("motivo_rechazo", "")
		guia.estado = Guia.Estado.BORRADOR
		guia.motivo_rechazo = motivo_rechazo
		guia.resolucion_numero = None
		guia.save(update_fields=["estado", "motivo_rechazo", "resolucion_numero", "updated_at"])

		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=guia.id,
			accion=AuditLog.Accion.UPDATE,
			usuario=request.user,
			datos_anteriores={"estado": Guia.Estado.PENDIENTE},
			datos_nuevos={"estado": guia.estado, "motivo_rechazo": motivo_rechazo},
		)

		return Response(
			{
				"detail": "Guía devuelta al administrador.",
				"estado": guia.estado,
				"motivo_rechazo": guia.motivo_rechazo,
			},
			status=status.HTTP_200_OK,
		)

	@action(detail=True, methods=["patch"], url_path="cambiar-estado")
	def cambiar_estado(self, request, pk=None):
		guia = self.get_object()

		# Solo admin/jefe/decano puede cambiar estado
		user_rol = getattr(request.user, "rol", "")
		if user_rol not in [getattr(request.user.Rol, "ADMIN", "ADMIN"), getattr(request.user.Rol, "JEFE", "JEFE"), getattr(request.user.Rol, "DECANO", "DECANO")]:
			return Response(
				{"error": "No autorizado para cambiar el estado"},
				status=status.HTTP_403_FORBIDDEN,
			)

		nuevo_estado = request.data.get("estado")
		estados_validos = ["BORRADOR", "PENDIENTE", "PENDIENTE_APROBACION", "APROBADO", "PUBLICADO"]

		if not nuevo_estado or nuevo_estado not in estados_validos:
			return Response(
				{"error": f"Estado inválido. Opciones: {estados_validos}"},
				status=status.HTTP_400_BAD_REQUEST,
			)

		# Requiere número de resolución para publicar (COMENTADO TEMPORALMENTE PARA TESTING FRONTEND)
		# if nuevo_estado == "PUBLICADO" and not guia.resolucion_numero:
		# 	return Response(
		# 		{"error": "Se requiere número de resolución para publicar"},
		# 		status=status.HTTP_400_BAD_REQUEST,
		# 	)

		guia.estado = nuevo_estado
		guia.save(update_fields=["estado", "updated_at"])
		return Response({"status": "ok", "nuevo_estado": nuevo_estado})



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
