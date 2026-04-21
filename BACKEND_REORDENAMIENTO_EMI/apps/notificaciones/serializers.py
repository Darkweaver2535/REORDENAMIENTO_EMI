from rest_framework import serializers

from apps.notificaciones.models import Notificacion


class NotificacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Notificacion
        fields = [
            "id",
            "tipo",
            "tipo_display",
            "mensaje",
            "leida",
            "objeto_id",
            "objeto_url",
            "created_at",
        ]
        read_only_fields = ["id", "tipo", "tipo_display", "mensaje", "objeto_id", "objeto_url", "created_at"]
