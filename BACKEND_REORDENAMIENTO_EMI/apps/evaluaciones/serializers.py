from rest_framework import serializers

from apps.evaluaciones.models import Evaluacion


class EvaluacionSerializer(serializers.ModelSerializer):
    evaluador_nombre = serializers.SerializerMethodField()
    equipo_nombre = serializers.SerializerMethodField()
    equipo_codigo = serializers.SerializerMethodField()
    equipo_cantidad = serializers.SerializerMethodField()
    laboratorio_nombre = serializers.SerializerMethodField()
    condicion_predominante = serializers.ReadOnlyField()
    porcentaje_bueno = serializers.ReadOnlyField()
    total_unidades = serializers.ReadOnlyField()

    def get_evaluador_nombre(self, obj):
        if obj.evaluador:
            return obj.evaluador.nombre_completo or obj.evaluador.username
        return "Sin registrar"

    def get_equipo_nombre(self, obj):
        return obj.equipo.nombre if obj.equipo else None

    def get_equipo_codigo(self, obj):
        return obj.equipo.codigo_activo if obj.equipo else None

    def get_equipo_cantidad(self, obj):
        return obj.equipo.cantidad_total if obj.equipo else None

    def get_laboratorio_nombre(self, obj):
        return obj.laboratorio.nombre if obj.laboratorio else None

    def validate(self, data):
        """Valida distribución de cantidades."""
        equipo = data.get("equipo") or (self.instance.equipo if self.instance else None)
        if equipo:
            total = (
                data.get("cantidad_bueno", 0)
                + data.get("cantidad_regular", 0)
                + data.get("cantidad_malo", 0)
            )
            if total == 0:
                raise serializers.ValidationError(
                    "Debe clasificar al menos una unidad."
                )
            if equipo.cantidad_total > 0 and total != equipo.cantidad_total:
                raise serializers.ValidationError(
                    f"La suma de unidades ({total}) debe ser igual "
                    f"a la cantidad del equipo ({equipo.cantidad_total})."
                )
        return data

    class Meta:
        model = Evaluacion
        fields = [
            "id",
            "equipo",
            "equipo_nombre",
            "equipo_codigo",
            "equipo_cantidad",
            "laboratorio",
            "laboratorio_nombre",
            "evaluador",
            "evaluador_nombre",
            "cantidad_bueno",
            "cantidad_regular",
            "cantidad_malo",
            "total_unidades",
            "condicion_predominante",
            "porcentaje_bueno",
            "observaciones",
            "fecha",
        ]
        read_only_fields = [
            "fecha",
            "evaluador",
            "evaluador_nombre",
            "equipo_nombre",
            "equipo_codigo",
            "equipo_cantidad",
            "laboratorio_nombre",
            "condicion_predominante",
            "porcentaje_bueno",
            "total_unidades",
        ]
