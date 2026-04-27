from django.contrib import admin

from apps.evaluaciones.models import Evaluacion


@admin.register(Evaluacion)
class EvaluacionAdmin(admin.ModelAdmin):
    list_display = [
        "equipo",
        "laboratorio",
        "evaluador",
        "cantidad_bueno",
        "cantidad_regular",
        "cantidad_malo",
        "condicion_predominante",
        "fecha",
    ]
    list_filter = ["laboratorio", "fecha"]
    search_fields = ["equipo__nombre", "evaluador__username"]
    readonly_fields = [
        "fecha",
        "condicion_predominante",
        "porcentaje_bueno",
        "total_unidades",
    ]
    fieldsets = (
        (
            "Equipo y contexto",
            {"fields": ("equipo", "laboratorio", "evaluador")},
        ),
        (
            "Distribución de condiciones",
            {
                "fields": (
                    "cantidad_bueno",
                    "cantidad_regular",
                    "cantidad_malo",
                    "total_unidades",
                    "condicion_predominante",
                    "porcentaje_bueno",
                ),
                "description": "La suma debe ser igual a la cantidad total del equipo.",
            },
        ),
        ("Observaciones", {"fields": ("observaciones",)}),
        ("Fechas", {"fields": ("fecha",), "classes": ("collapse",)}),
    )
