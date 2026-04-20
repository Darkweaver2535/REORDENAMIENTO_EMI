from django.db import transaction
from rest_framework import serializers

from apps.guias.models import Guia
from apps.laboratorios.models import EquipoRequeridoPorGuia


class EquipoRequeridoListSerializer(serializers.ModelSerializer):
	equipo_nombre = serializers.SerializerMethodField()
	tiene_deficit = serializers.SerializerMethodField()
	cantidad_deficit = serializers.SerializerMethodField()

	class Meta:
		model = EquipoRequeridoPorGuia
		fields = (
			"id",
			"nombre_equipo_teorico",
			"equipo_id",
			"equipo_nombre",
			"cantidad_requerida",
			"tiene_deficit",
			"cantidad_deficit",
			"notas",
		)

	def get_equipo_nombre(self, obj):
		if obj.equipo_id is None:
			return None
		return obj.equipo.nombre

	def get_tiene_deficit(self, obj):
		return obj.tiene_deficit()

	def get_cantidad_deficit(self, obj):
		return obj.cantidad_deficit()


class GuiaListSerializer(serializers.ModelSerializer):
	asignatura_nombre = serializers.CharField(source="asignatura.nombre", read_only=True)

	class Meta:
		model = Guia
		fields = (
			"id",
			"titulo",
			"numero_practica",
			"asignatura_id",
			"asignatura_nombre",
			"portada_url",
			"pdf_url",
			"estado",
			"created_at",
		)


class GuiaDetalleSerializer(GuiaListSerializer):
	aprobado_por_nombre = serializers.SerializerMethodField()
	resolucion_numero = serializers.CharField(read_only=True)
	motivo_rechazo = serializers.CharField(read_only=True)
	equipos_requeridos = EquipoRequeridoListSerializer(many=True, read_only=True)

	class Meta(GuiaListSerializer.Meta):
		fields = GuiaListSerializer.Meta.fields + (
			"resolucion_numero",
			"motivo_rechazo",
			"aprobado_por_nombre",
			"updated_at",
			"equipos_requeridos",
		)

	def get_aprobado_por_nombre(self, obj):
		if obj.aprobado_por_id is None:
			return None
		return obj.aprobado_por.nombre_completo


class GuiaCrearSerializer(serializers.ModelSerializer):
	class Meta:
		model = Guia
		fields = (
			"titulo",
			"numero_practica",
			"asignatura",
			"portada_url",
			"pdf_url",
			"estado",
		)
		extra_kwargs = {
			"portada_url": {"required": False, "allow_blank": True, "allow_null": True},
			"estado": {"required": False},
		}

	def validate(self, attrs):
		asignatura = attrs.get("asignatura", getattr(self.instance, "asignatura", None))
		numero_practica = attrs.get("numero_practica", getattr(self.instance, "numero_practica", None))

		qs = Guia.objects.filter(asignatura=asignatura, numero_practica=numero_practica)

		if self.instance:
			qs = qs.exclude(pk=self.instance.pk)

		if qs.exists():
			raise serializers.ValidationError(
				f"Ya existe la Práctica {numero_practica} para esta asignatura."
			)

		return attrs

	@transaction.atomic
	def create(self, validated_data):
		validated_data["estado"] = Guia.Estado.BORRADOR
		validated_data["codigo_interno"] = self._generar_codigo_interno(validated_data)
		return super().create(validated_data)

	def _generar_codigo_interno(self, validated_data):
		asignatura = validated_data["asignatura"]
		numero_practica = validated_data["numero_practica"]
		base = f"GUIA-{asignatura.codigo_curricular}-{numero_practica}".upper()

		codigo = base
		contador = 1
		while Guia.objects.filter(codigo_interno=codigo).exists():
			contador += 1
			codigo = f"{base}-{contador}"

		return codigo


class GuiaCambioEstadoSerializer(serializers.Serializer):
	"""Serializer para cambios de estado en guías (publicar, rechazar, etc.)."""

	resolucion_numero = serializers.CharField(
		max_length=50,
		required=False,
		allow_blank=True,
	)
	motivo_rechazo = serializers.CharField(
		required=False,
		allow_blank=True,
	)

	def validate(self, attrs):
		"""Valida que resolucion_numero esté presente si se va a publicar."""
		resolucion_numero = attrs.get("resolucion_numero", "").strip()

		if self.context.get("action") == "publicar" and not resolucion_numero:
			raise serializers.ValidationError(
				{"resolucion_numero": "Se requiere número de resolución para publicar."}
			)

		return attrs


# Alias para compatibilidad con vistas existentes (opcional)
GuiaEstadoSerializer = GuiaCambioEstadoSerializer
