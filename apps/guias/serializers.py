# App: guias | Archivo: serializers.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear serializers para el módulo de guías con control de estado:
#
# 1. GuiaListSerializer (lectura, para listas):
#    - Campos: id, titulo, numero_practica, asignatura_id, asignatura_nombre,
#      portada_url, estado, created_at
#    - FILTRO: solo mostrar estado='publicado' para usuarios con rol estudiante/docente
#      Implementar esto en get_queryset del ViewSet, NO aquí
#
# 2. GuiaDetalleSerializer (lectura, para detalle):
#    - Todos los campos de GuiaListSerializer +
#    - pdf_url, resolucion_numero, aprobado_por_nombre
#    - equipos_requeridos: lista anidada con EquipoRequeridoSerializer
#
# 3. GuiaCrearSerializer (escritura, solo para admin/jefe):
#    - Campos editables: titulo, numero_practica, asignatura, portada_url, pdf_url
#    - estado siempre se crea como 'borrador' (no editable por el usuario)
#    - Validación: verificar que no exista ya una guía con el mismo
#      (asignatura, numero_practica)
#
# 4. GuiaEstadoSerializer (para cambios de estado - transiciones):
#    - Campos: estado, resolucion_numero, motivo_rechazo
#    - Validar que si estado='publicado', resolucion_numero no sea vacío
#
# 5. EquipoRequeridoSerializer:
#    - Campos: id, nombre_equipo_teorico, equipo_id, equipo_nombre,
#      cantidad_requerida, tiene_deficit, cantidad_deficit

from django.db import transaction
from rest_framework import serializers

from apps.guias.models import Guia
from apps.laboratorios.models import EquipoRequeridoPorGuia


class EquipoRequeridoSerializer(serializers.ModelSerializer):
	equipo_nombre = serializers.CharField(source="equipo.nombre", read_only=True)
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
		)

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
			"estado",
			"created_at",
		)


class GuiaDetalleSerializer(GuiaListSerializer):
	aprobado_por_nombre = serializers.CharField(source="aprobado_por.nombre_completo", read_only=True)
	pdf_url = serializers.URLField(read_only=True)
	resolucion_numero = serializers.CharField(read_only=True)
	equipos_requeridos = EquipoRequeridoSerializer(many=True, read_only=True)

	class Meta(GuiaListSerializer.Meta):
		fields = GuiaListSerializer.Meta.fields + (
			"pdf_url",
			"resolucion_numero",
			"aprobado_por_nombre",
			"equipos_requeridos",
		)


class GuiaCrearSerializer(serializers.ModelSerializer):
	class Meta:
		model = Guia
		fields = (
			"titulo",
			"numero_practica",
			"asignatura",
			"portada_url",
			"pdf_url",
		)

	def validate(self, attrs):
		asignatura = attrs.get("asignatura")
		numero_practica = attrs.get("numero_practica")

		if Guia.objects.filter(asignatura=asignatura, numero_practica=numero_practica).exists():
			raise serializers.ValidationError(
				"Ya existe una guia para esa asignatura con el mismo numero de practica."
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


class GuiaEstadoSerializer(serializers.ModelSerializer):
	class Meta:
		model = Guia
		fields = ("estado", "resolucion_numero", "motivo_rechazo")

	def validate(self, attrs):
		estado = attrs.get("estado", getattr(self.instance, "estado", None))
		resolucion_numero = attrs.get("resolucion_numero", getattr(self.instance, "resolucion_numero", None))

		if estado == Guia.Estado.PUBLICADO and not resolucion_numero:
			raise serializers.ValidationError(
				{"resolucion_numero": "La resolucion_numero es obligatoria para publicar una guia."}
			)

		return attrs
