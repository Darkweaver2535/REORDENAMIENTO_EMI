from rest_framework import serializers

from apps.laboratorios.models import Equipo, Laboratorio, TipoEquipo, UsoAcademico


class LaboratorioListSerializer(serializers.ModelSerializer):
    unidad_academica_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Laboratorio
        fields = (
            "id",
            "nombre",
            "unidad_academica_id",
            "unidad_academica_nombre",
            "campus",
            "edificio",
            "piso",
            "sala",
            "capacidad_estudiantes",
        )

    def get_unidad_academica_nombre(self, obj):
        if obj.unidad_academica_id is None:
            return None
        return obj.unidad_academica.nombre

    def get_total_equipos_disponibles(self, obj):
        equipos = Equipo.objects.filter(laboratorio=obj)
        return sum(eq.cantidad_disponible() for eq in equipos)


class UsoAcademicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsoAcademico
        fields = ("id", "asignatura", "semestre", "carrera")


class LaboratorioDetalleSerializer(LaboratorioListSerializer):
    total_equipos = serializers.SerializerMethodField()
    total_equipos_disponibles = serializers.SerializerMethodField()
    usos_academicos = UsoAcademicoSerializer(many=True, read_only=True)

    class Meta(LaboratorioListSerializer.Meta):
        fields = LaboratorioListSerializer.Meta.fields + (
            "total_equipos",
            "total_equipos_disponibles",
            "usos_academicos",
            "usa_pea",
            "usa_investigacion",
            "usa_venta_servicios",
            "normativa_infraestructura",
        )

    def get_total_equipos(self, obj):
        return Equipo.objects.filter(laboratorio=obj).count()

    def get_total_equipos_disponibles(self, obj):
        equipos = Equipo.objects.filter(laboratorio=obj)
        return sum(eq.cantidad_disponible() for eq in equipos)


class EquipoListSerializer(serializers.ModelSerializer):
    laboratorio_nombre = serializers.SerializerMethodField()
    laboratorio_unidad_academica_id = serializers.SerializerMethodField()
    laboratorio_unidad_academica_nombre = serializers.SerializerMethodField()
    cantidad_disponible = serializers.SerializerMethodField()
    evaluado_por_nombre = serializers.SerializerMethodField()
    ultima_evaluacion = serializers.SerializerMethodField()
    laboratorio_id = serializers.PrimaryKeyRelatedField(
        source="laboratorio",
        queryset=Laboratorio.objects.all(),
        required=False,
        allow_null=True,
    )
    # Catálogo canónico (#12)
    tipo_id = serializers.PrimaryKeyRelatedField(
        source="tipo",
        queryset=TipoEquipo.objects.all(),
        required=False,
        allow_null=True,
    )
    tipo_nombre = serializers.CharField(source="tipo.nombre", read_only=True, default=None)

    class Meta:
        model = Equipo
        fields = (
            "id",
            "nombre",
            "codigo_activo",
            "unidad_academica_id",
            "laboratorio_id",
            "laboratorio_nombre",
            "laboratorio_unidad_academica_id",
            "laboratorio_unidad_academica_nombre",
            "tipo_id",
            "tipo_nombre",
            "cantidad_total",
            "cantidad_buena",
            "cantidad_regular",
            "cantidad_mala",
            "cantidad_disponible",
            "estatus_general",
            "evaluado_en",
            "evaluado_por_nombre",
            "observaciones",
            "foto_url",
            "ultima_evaluacion",
        )

    def validate_cantidad_total(self, value):
        # #13: cada equipo es una unidad física individual (código y estado
        # propios). La cantidad solo puede ser 0 (p. ej. recién comprado, aún sin
        # recepcionar) o 1. El modelo de "lote" (cantidad > 1) quedó obsoleto.
        if value > 1:
            raise serializers.ValidationError(
                "Cada equipo es una unidad individual: la cantidad debe ser 0 o 1."
            )
        return value

    def get_laboratorio_nombre(self, obj):
        if obj.laboratorio_id is None:
            return None
        return obj.laboratorio.nombre

    def get_laboratorio_unidad_academica_id(self, obj):
        if obj.laboratorio_id is None:
            return None
        return obj.laboratorio.unidad_academica_id

    def get_laboratorio_unidad_academica_nombre(self, obj):
        if obj.laboratorio_id is None or obj.laboratorio.unidad_academica_id is None:
            return None
        return obj.laboratorio.unidad_academica.nombre

    def get_cantidad_disponible(self, obj):
        return obj.cantidad_disponible()

    def get_evaluado_por_nombre(self, obj):
        if obj.evaluado_por_id is None:
            return None
        return obj.evaluado_por.nombre_completo

    def get_ultima_evaluacion(self, obj):
        ev = obj.evaluaciones.first()  # ordered by -fecha
        if not ev:
            return None
        return {
            "id": ev.id,
            "cantidad_bueno": ev.cantidad_bueno,
            "cantidad_regular": ev.cantidad_regular,
            "cantidad_malo": ev.cantidad_malo,
            "total_unidades": ev.total_unidades,
            "condicion_predominante": ev.condicion_predominante,
            "porcentaje_bueno": ev.porcentaje_bueno,
            "observaciones": ev.observaciones,
            "fecha": ev.fecha,
            "evaluador_nombre": (ev.evaluador.nombre_completo or ev.evaluador.username)
            if ev.evaluador
            else "Sin registrar",
        }


class EquipoDetalleSerializer(EquipoListSerializer):
    class Meta(EquipoListSerializer.Meta):
        fields = EquipoListSerializer.Meta.fields + (
            "ubicacion_sala",
            "especificaciones",
            "notas",
            "requiere_mantenimiento",
        )


class TipoEquipoSerializer(serializers.ModelSerializer):
    """Catálogo canónico de tipos de equipo (#12)."""

    total_equipos = serializers.IntegerField(read_only=True)

    class Meta:
        model = TipoEquipo
        fields = (
            "id",
            "nombre",
            "categoria",
            "descripcion",
            "activo",
            "total_equipos",
        )


class EvaluacionInsituSerializer(serializers.Serializer):
    """Serializer para registrar evaluación in-situ de equipos.

    Acepta dos modos:
      1. Modo rápido: solo condicion + observaciones
      2. Modo detallado: cantidades individuales buena/regular/mala
    """

    condicion = serializers.ChoiceField(
        choices=[("bueno", "Bueno"), ("regular", "Regular"), ("malo", "Malo")],
        required=True,
        help_text="Estado general del equipo tras la evaluación.",
    )
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    cantidad_buena = serializers.IntegerField(min_value=0, required=False, default=0)
    cantidad_regular = serializers.IntegerField(min_value=0, required=False, default=0)
    cantidad_mala = serializers.IntegerField(min_value=0, required=False, default=0)

    def validate(self, attrs):
        buena = attrs.get("cantidad_buena", 0)
        regular = attrs.get("cantidad_regular", 0)
        mala = attrs.get("cantidad_mala", 0)
        suma = buena + regular + mala

        equipo = self.context.get("equipo")
        total = equipo.cantidad_total if equipo else 0

        # Si no se proporcionaron cantidades detalladas, auto-fill según condición
        if suma == 0 and total > 0:
            condicion = attrs["condicion"]
            if condicion == "bueno":
                attrs["cantidad_buena"] = total
            elif condicion == "regular":
                attrs["cantidad_regular"] = total
            else:
                attrs["cantidad_mala"] = total
            suma = total

        attrs["cantidad_total"] = suma if suma > 0 else max(total, 1)

        return attrs


# ── Serializer de árbol jerárquico ────────────────────────────────────────────


class LaboratorioTreeSerializer(serializers.ModelSerializer):
    """
    Serializer recursivo para representar el árbol padre-hijo de laboratorios.
    Cada nodo incluye su lista de hijos anidados (recursión via get_hijos).

    Uso:
        raices = Laboratorio.objects.filter(parent=None).prefetch_related('hijos__hijos__hijos__hijos')
        data = LaboratorioTreeSerializer(raices, many=True).data
    """

    unidad_academica_nombre = serializers.SerializerMethodField()
    es_hoja = serializers.SerializerMethodField()
    hijos = serializers.SerializerMethodField()

    class Meta:
        model = Laboratorio
        fields = (
            "id",
            "nombre",
            "clase_nodo",
            "subtipo_espacio",
            "parent",
            "unidad_academica_id",
            "unidad_academica_nombre",
            "campus",
            "sala",
            "superficie_m2",
            "ubicacion",
            "capacidad_estudiantes",
            "is_active",
            "es_hoja",
            "hijos",
        )

    def get_unidad_academica_nombre(self, obj):
        if obj.unidad_academica_id is None:
            return None
        return obj.unidad_academica.nombre

    def get_es_hoja(self, obj):
        return obj.es_hoja()

    def get_hijos(self, obj):
        # La recursión se detiene naturalmente cuando hijos.all() retorna queryset vacío
        hijos_qs = obj.hijos.all()
        if not hijos_qs.exists():
            return []
        return LaboratorioTreeSerializer(hijos_qs, many=True, context=self.context).data
