from rest_framework import serializers

from apps.mantenimientos.models import RegistroMantenimiento


class RegistroMantenimientoSerializer(serializers.ModelSerializer):
	realizado_por_nombre = serializers.SerializerMethodField()
	tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
	estado_display = serializers.CharField(source="get_estado_display", read_only=True)
	es_calibracion = serializers.ReadOnlyField()
	dias_para_proximo = serializers.ReadOnlyField()

	class Meta:
		model = RegistroMantenimiento
		fields = [
			"id",
			"equipo",
			"tipo",
			"tipo_display",
			"estado",
			"estado_display",
			"descripcion",
			"observaciones",
			"fecha_realizacion",
			"fecha_proximo",
			"dias_para_proximo",
			"numero_certificado",
			"entidad_calibradora",
			"realizado_por",
			"realizado_por_nombre",
			"es_calibracion",
			"fecha_registro",
		]
		read_only_fields = [
			"realizado_por",
			"realizado_por_nombre",
			"tipo_display",
			"estado_display",
			"es_calibracion",
			"dias_para_proximo",
			"fecha_registro",
		]

	def get_realizado_por_nombre(self, obj):
		if obj.realizado_por:
			nombre = getattr(obj.realizado_por, "nombre_completo", None)
			return nombre or obj.realizado_por.username
		return "Sin registrar"
