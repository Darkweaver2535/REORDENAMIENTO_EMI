from rest_framework import serializers

from apps.estructura_academica.serializers import AsignaturaListSerializer
from apps.laboratorios.models import Equipo, Laboratorio


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


class LaboratorioDetalleSerializer(LaboratorioListSerializer):
	total_equipos = serializers.SerializerMethodField()
	total_equipos_disponibles = serializers.SerializerMethodField()
	asignaturas = AsignaturaListSerializer(many=True, read_only=True)

	class Meta(LaboratorioListSerializer.Meta):
		fields = LaboratorioListSerializer.Meta.fields + (
			"total_equipos",
			"total_equipos_disponibles",
			"asignaturas",
		)

	def get_total_equipos(self, obj):
		return Equipo.objects.filter(laboratorio=obj).count()

	def get_total_equipos_disponibles(self, obj):
		equipos = Equipo.objects.filter(laboratorio=obj)
		return sum(eq.cantidad_disponible() for eq in equipos)


class EquipoListSerializer(serializers.ModelSerializer):
	laboratorio_nombre = serializers.SerializerMethodField()
	cantidad_disponible = serializers.SerializerMethodField()
	evaluado_por_nombre = serializers.SerializerMethodField()

	class Meta:
		model = Equipo
		fields = (
			"id",
			"nombre",
			"codigo_activo",
			"laboratorio_id",
			"laboratorio_nombre",
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
		)

	def get_laboratorio_nombre(self, obj):
		if obj.laboratorio_id is None:
			return None
		return obj.laboratorio.nombre

	def get_cantidad_disponible(self, obj):
		return obj.cantidad_disponible()

	def get_evaluado_por_nombre(self, obj):
		if obj.evaluado_por_id is None:
			return None
		return obj.evaluado_por.nombre_completo


class EquipoDetalleSerializer(EquipoListSerializer):

	class Meta(EquipoListSerializer.Meta):
		fields = EquipoListSerializer.Meta.fields + (
			"ubicacion_sala",
			"especificaciones",
			"notas",
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

