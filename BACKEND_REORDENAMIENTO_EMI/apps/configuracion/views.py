from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.configuracion.models import ConfiguracionSistema
from apps.configuracion.serializers import ConfiguracionSerializer
from apps.usuarios.models import Usuario


class ConfiguracionView(APIView):
    """
    GET /api/v1/configuracion/ - Retorna la configuración global.
    PATCH /api/v1/configuracion/ - Actualiza la configuración global (solo Admin).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = ConfiguracionSistema.get_config()
        return Response(ConfiguracionSerializer(config).data)

    def patch(self, request):
        # Solo admin puede actualizar
        if request.user.rol != Usuario.Rol.ADMIN:
            return Response(
                {"error": "No autorizado"},
                status=status.HTTP_403_FORBIDDEN,
            )
            
        config = ConfiguracionSistema.get_config()
        serializer = ConfiguracionSerializer(
            config, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
