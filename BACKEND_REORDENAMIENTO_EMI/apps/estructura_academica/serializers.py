from rest_framework import serializers

from apps.estructura_academica.models import (
    Asignatura,
    Carrera,
    Departamento,
    Semestre,
    UnidadAcademica,
)


class UnidadAcademicaSerializer(serializers.ModelSerializer):
    # El formulario de administración pide nombre, abreviación y ciudad; el
    # código es un correlativo institucional ("0001"…) que se asigna solo.
    codigo = serializers.CharField(max_length=10, required=False)

    class Meta:
        model = UnidadAcademica
        fields = ("id", "nombre", "ciudad", "codigo", "abreviacion")

    def validate_nombre(self, value):
        nombre = (value or "").strip()
        if not nombre:
            raise serializers.ValidationError("El nombre es obligatorio.")
        existe = UnidadAcademica.objects.filter(nombre__iexact=nombre)
        if self.instance:
            existe = existe.exclude(pk=self.instance.pk)
        if existe.exists():
            raise serializers.ValidationError("Ya existe una unidad académica con ese nombre.")
        return nombre

    def create(self, validated_data):
        if not validated_data.get("codigo"):
            usados = {
                c for c in UnidadAcademica.objects.values_list("codigo", flat=True)
                if c and c.isdigit()
            }
            siguiente = 1
            while f"{siguiente:04d}" in usados:
                siguiente += 1
            validated_data["codigo"] = f"{siguiente:04d}"
        return super().create(validated_data)


class DepartamentoSerializer(serializers.ModelSerializer):
    unidades_academicas = UnidadAcademicaSerializer(many=True, read_only=True)

    class Meta:
        model = Departamento
        fields = (
            "id",
            "nombre",
            "codigo",
            "unidades_academicas",
        )


class CarreraSedeSerializer(serializers.ModelSerializer):
    """Serializer ligero para las unidades académicas de una carrera."""

    class Meta:
        model = UnidadAcademica
        fields = ("id", "nombre", "codigo", "abreviacion")


class CarreraSerializer(serializers.ModelSerializer):
    unidades_academicas = CarreraSedeSerializer(many=True, read_only=True)

    class Meta:
        model = Carrera
        fields = ("id", "nombre", "codigo_institucional", "departamento_id", "unidades_academicas")


class SemestreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semestre
        fields = ("id", "numero", "nombre")


class AsignaturaListSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.SerializerMethodField()
    semestre_numero = serializers.SerializerMethodField()

    class Meta:
        model = Asignatura
        fields = (
            "id",
            "nombre",
            "codigo_curricular",
            "carrera_id",
            "semestre_id",
            "carrera_nombre",
            "semestre_numero",
        )

    def get_carrera_nombre(self, instance):
        if instance.carrera_id is None:
            return None
        return instance.carrera.nombre

    def get_semestre_numero(self, instance):
        if instance.semestre_id is None:
            return None
        return instance.semestre.numero


class AsignaturaDetalleSerializer(AsignaturaListSerializer):
    carrera = CarreraSerializer(read_only=True)
    semestre = SemestreSerializer(read_only=True)

    class Meta(AsignaturaListSerializer.Meta):
        fields = AsignaturaListSerializer.Meta.fields + (
            "carrera",
            "semestre",
        )
