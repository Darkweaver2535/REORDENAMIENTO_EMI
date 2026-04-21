from rest_framework import serializers

from apps.usuarios.models import Usuario


class LoginSerializer(serializers.Serializer):
    """Serializer para validar credenciales en el endpoint de login."""

    carnet_identidad = serializers.CharField(
        max_length=20,
        required=True,
        allow_blank=False,
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        allow_blank=False,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        if not attrs.get("carnet_identidad"):
            raise serializers.ValidationError("carnet_identidad es requerido.")
        if not attrs.get("password"):
            raise serializers.ValidationError("password es requerido.")
        return attrs


class LoginResponseSerializer(serializers.Serializer):
    """Serializer documenta la respuesta de autenticación (read-only)."""

    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    rol = serializers.CharField()
    nombre_completo = serializers.CharField()
    unidad_academica_id = serializers.IntegerField(allow_null=True)
    unidad_academica_nombre = serializers.CharField(allow_null=True)


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Datos mínimos de usuario para listas."""

    class Meta:
        model = Usuario
        fields = (
            "id",
            "carnet_identidad",
            "nombre_completo",
            "rol",
            "unidad_academica_id",
            "is_active",
        )


class UsuarioDetalleSerializer(serializers.ModelSerializer):
    """Perfil completo del usuario autenticado."""

    unidad_academica_nombre = serializers.CharField(
        source="unidad_academica.nombre",
        read_only=True,
    )

    class Meta:
        model = Usuario
        fields = (
            "id",
            "carnet_identidad",
            "nombre_completo",
            "email",
            "saga_username",
            "rol",
            "unidad_academica_id",
            "unidad_academica_nombre",
            "is_active",
            "last_login",
        )
        read_only_fields = (
            "id",
            "carnet_identidad",
            "rol",
            "unidad_academica_id",
            "unidad_academica_nombre",
            "is_active",
            "last_login",
        )


# Alias para compatibilidad con vistas existentes
PerfilSerializer = UsuarioDetalleSerializer
UsuarioListaSerializer = UsuarioResumenSerializer
