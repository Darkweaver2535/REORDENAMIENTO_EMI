from rest_framework import serializers

from apps.usuarios.models import Usuario


class PerfilSerializer(serializers.ModelSerializer):
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
            "unidad_academica",
            "unidad_academica_nombre",
        )
        read_only_fields = (
            "id",
            "carnet_identidad",
            "rol",
            "unidad_academica",
            "unidad_academica_nombre",
        )


class UsuarioListaSerializer(serializers.ModelSerializer):
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
            "rol",
            "unidad_academica",
            "unidad_academica_nombre",
            "is_active",
        )
