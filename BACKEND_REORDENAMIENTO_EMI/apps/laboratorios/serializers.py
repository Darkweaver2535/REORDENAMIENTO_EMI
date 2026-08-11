from rest_framework import serializers

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio, TipoEquipo, UsoAcademico


class LaboratorioListSerializer(serializers.ModelSerializer):
    unidad_academica_nombre = serializers.SerializerMethodField()
    # Escribibles: sin esto DRF los mapea como read-only y el create termina en
    # IntegrityError (unidad_academica_id NULL) en vez de un 400 entendible.
    unidad_academica_id = serializers.PrimaryKeyRelatedField(
        source="unidad_academica",
        queryset=UnidadAcademica.objects.all(),
        required=False,
        allow_null=True,
    )
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=Laboratorio.objects.all(),
        required=False,
        allow_null=True,
    )
    parent_nombre = serializers.CharField(source="parent.nombre", read_only=True, default=None)

    class Meta:
        model = Laboratorio
        fields = (
            "id",
            "nombre",
            "unidad_academica_id",
            "unidad_academica_nombre",
            "clase_nodo",
            "subtipo_espacio",
            "parent_id",
            "parent_nombre",
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

    def validate(self, attrs):
        """Valida UA obligatoria (directa o heredada del padre) y bloquea
        homónimos en el mismo nivel: mismo nombre + mismo padre + misma UA."""
        instance = self.instance

        nombre = (attrs.get("nombre") or (instance.nombre if instance else "")).strip()
        parent = attrs.get("parent", instance.parent if instance else None)
        unidad = attrs.get("unidad_academica") or (
            instance.unidad_academica if instance else None
        )

        # La UA puede heredarse del padre (igual que hace el modelo en save())
        if not unidad and parent is not None:
            unidad = parent.unidad_academica
        if not unidad:
            raise serializers.ValidationError(
                {
                    "unidad_academica_id": (
                        "Debes indicar la unidad académica (o un espacio padre del cual heredarla)."
                    )
                }
            )
        attrs["unidad_academica"] = unidad

        # Mantiene el invariante de la jerarquía sin exigir el campo al cliente
        if instance is None and "clase_nodo" not in attrs:
            attrs["clase_nodo"] = (
                Laboratorio.ClaseNodo.SUBESPACIO if parent else Laboratorio.ClaseNodo.GENERAL
            )

        if nombre:
            homonimos = Laboratorio.objects.filter(
                nombre__iexact=nombre,
                parent_id=parent.pk if parent else None,
                unidad_academica_id=unidad.pk,
            )
            if instance:
                homonimos = homonimos.exclude(pk=instance.pk)
            if homonimos.exists():
                raise serializers.ValidationError(
                    {
                        "nombre": (
                            f'Ya existe un laboratorio llamado "{nombre}" en ese mismo '
                            "nivel de la unidad académica."
                        )
                    }
                )
        return attrs

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
        # `.first()` construye un queryset nuevo y consulta la BD por cada
        # equipo (N+1). Iterar sobre `.all()` reutiliza el prefetch de la vista;
        # el orden ya viene por -fecha desde Meta.ordering de Evaluacion.
        ev = next(iter(obj.evaluaciones.all()), None)
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

    def validate(self, attrs):
        """Las cantidades tienen que ser posibles.

        La API aceptaba crear un equipo con cantidades negativas, y a partir de
        ahí todos los recuentos —dashboard, comparativa de sedes, porcentaje de
        operativos— quedaban mal sin que nada lo delatara. Se exige lo mismo que
        comprueba `auditar_integridad`: nada por debajo de cero y el total igual
        a la suma de las tres condiciones.
        """
        datos = {**getattr(self, "initial_data", {}), **attrs}
        instancia = self.instance

        def valor(campo):
            if campo in attrs:
                return attrs[campo]
            if instancia is not None:
                return getattr(instancia, campo)
            return datos.get(campo, 0) or 0

        cantidades = {c: valor(c) for c in
                      ("cantidad_total", "cantidad_buena", "cantidad_regular", "cantidad_mala")}
        negativas = {c: v for c, v in cantidades.items() if isinstance(v, int) and v < 0}
        if negativas:
            raise serializers.ValidationError(
                {c: "La cantidad no puede ser negativa." for c in negativas})

        suma = (cantidades["cantidad_buena"] + cantidades["cantidad_regular"]
                + cantidades["cantidad_mala"])
        if cantidades["cantidad_total"] != suma:
            raise serializers.ValidationError({
                "cantidad_total": (
                    f"El total ({cantidades['cantidad_total']}) debe ser la suma de buenos, "
                    f"regulares y malos ({suma})."
                )
            })
        return attrs


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
    # El formulario de evaluación in situ permite corregir dónde está el equipo
    # (mesón, estante). Sin declararlo aquí, el dato se descartaba en silencio.
    ubicacion_sala = serializers.CharField(
        required=False, allow_blank=True, max_length=100,
        help_text="Ubicación física constatada durante la inspección.",
    )
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
