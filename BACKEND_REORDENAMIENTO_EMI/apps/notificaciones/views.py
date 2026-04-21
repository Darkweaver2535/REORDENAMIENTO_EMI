from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notificaciones.models import Notificacion
from apps.notificaciones.serializers import NotificacionSerializer


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificacionSerializer

    def get_queryset(self):
        queryset = Notificacion.objects.filter(usuario=self.request.user)
        leida = self.request.query_params.get("leida")
        if leida is not None:
            queryset = queryset.filter(leida=leida.lower() == "true")
        return queryset

    @action(detail=True, methods=["post"], url_path="marcar-leida")
    def marcar_leida(self, request, pk=None):
        notificacion = self.get_object()
        notificacion.leida = True
        notificacion.save()
        return Response({"status": "ok"})

    @action(detail=False, methods=["post"], url_path="marcar-todas-leidas")
    def marcar_todas_leidas(self, request):
        Notificacion.objects.filter(
            usuario=request.user, leida=False
        ).update(leida=True)
        return Response({"status": "ok"})
