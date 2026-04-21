from rest_framework import serializers

from apps.configuracion.models import ConfiguracionSistema


class ConfiguracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionSistema
        fields = [
            "id",
            "saga_auth_url",
            "modulo_reactivos_activo",
            "nombre_sistema",
            "version",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]
