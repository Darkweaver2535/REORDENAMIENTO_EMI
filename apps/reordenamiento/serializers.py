from rest_framework import serializers

from apps.laboratorios.models import Equipo, Laboratorio
from apps.reordenamiento.models import Reordenamiento


class ReordenamientoListSerializer(serializers.ModelSerializer):
	equipo_nombre = serializers.SerializerMethodField()
	laboratorio_origen_nombre = serializers.SerializerMethodField()
	laboratorio_destino_nombre = serializers.SerializerMethodField()
	es_inter_sede = serializers.SerializerMethodField()

	class Meta:
		model = Reordenamiento
		fields = (
			"id",
			"equipo_id",
			"equipo_nombre",
			"laboratorio_origen_nombre",
			"laboratorio_destino_nombre",
			"cantidad_trasladada",
			"estado",
			"resolucion_numero",
			"es_inter_sede",
			"created_at",
		)

	def get_equipo_nombre(self, obj):
		if obj.equipo_id is None:
			return None
		return obj.equipo.nombre

	def get_laboratorio_origen_nombre(self, obj):
		if obj.laboratorio_origen_id is None:
			return None
		return obj.laboratorio_origen.nombre

	def get_laboratorio_destino_nombre(self, obj):
		if obj.laboratorio_destino_id is None:
			return None
		return obj.laboratorio_destino.nombre

	def get_es_inter_sede(self, obj):
		return obj.es_inter_sede()


class ReordenamientoDetalleSerializer(ReordenamientoListSerializer):
	autorizado_por_nombre = serializers.SerializerMethodField()
	ejecutado_por_nombre = serializers.SerializerMethodField()

	class Meta(ReordenamientoListSerializer.Meta):
		fields = ReordenamientoListSerializer.Meta.fields + (
			"motivo",
			"autorizado_por_nombre",
			"ejecutado_por_nombre",
			"fecha_autorizacion",
			"fecha_ejecucion",
			"pdf_reporte_url",
		)

	def get_autorizado_por_nombre(self, obj):
		if obj.autorizado_por_id is None:
			return None
		return obj.autorizado_por.nombre_completo

	def get_ejecutado_por_nombre(self, obj):
		if obj.ejecutado_por_id is None:
			return None
		return obj.ejecutado_por.nombre_completo


class CrearReordenamientoSerializer(serializers.Serializer):
	"""Serializer para crear un nuevo reordenamiento con validaciones completas."""

	equipo_id = serializers.IntegerField()
	laboratorio_origen_id = serializers.IntegerField()
	laboratorio_destino_id = serializers.IntegerField()
	cantidad_trasladada = serializers.IntegerField(min_value=1)
	resolucion_numero = serializers.CharField(max_length=50, allow_blank=False)
	motivo = serializers.CharField(required=False, allow_blank=True)

	def validate(self, attrs):
		"""Valida todos los parámetros del reordenamiento."""
		equipo_id = attrs.get("equipo_id")
		laboratorio_origen_id = attrs.get("laboratorio_origen_id")
		laboratorio_destino_id = attrs.get("laboratorio_destino_id")
		cantidad_trasladada = attrs.get("cantidad_trasladada")

		# Verificar que el equipo existe y pertenece al laboratorio origen
		try:
			equipo = Equipo.objects.get(id=equipo_id)
		except Equipo.DoesNotExist:
			raise serializers.ValidationError({"equipo_id": "El equipo no existe."})

		if equipo.laboratorio_id != laboratorio_origen_id:
			raise serializers.ValidationError(
				{
					"equipo_id": (
						"El equipo no pertenece al laboratorio de origen especificado."
					)
				}
			)

		# Verificar cantidad disponible
		if cantidad_trasladada > equipo.cantidad_disponible():
			raise serializers.ValidationError(
				{
					"cantidad_trasladada": (
						f"Solo hay {equipo.cantidad_disponible()} unidades disponibles "
						f"de este equipo."
					)
				}
			)

		# Verificar que origen != destino
		if laboratorio_origen_id == laboratorio_destino_id:
			raise serializers.ValidationError(
				{
					"laboratorio_destino_id": (
						"El laboratorio de destino debe ser diferente del laboratorio de origen."
					)
				}
			)

		# Verificar que los laboratorios existen
		try:
			Laboratorio.objects.get(id=laboratorio_origen_id)
		except Laboratorio.DoesNotExist:
			raise serializers.ValidationError(
				{"laboratorio_origen_id": "El laboratorio de origen no existe."}
			)

		try:
			Laboratorio.objects.get(id=laboratorio_destino_id)
		except Laboratorio.DoesNotExist:
			raise serializers.ValidationError(
				{"laboratorio_destino_id": "El laboratorio de destino no existe."}
			)

		return attrs


class AutorizarReordenamientoSerializer(serializers.Serializer):
	"""Serializer para autorizar un reordenamiento."""

	comentario_autorizacion = serializers.CharField(required=False, allow_blank=True)
