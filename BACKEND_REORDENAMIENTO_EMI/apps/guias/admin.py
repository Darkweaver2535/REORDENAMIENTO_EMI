from django.contrib import admin

from apps.guias.models import Guia


@admin.register(Guia)
class GuiaAdmin(admin.ModelAdmin):
    list_display = (
        "titulo",
        "numero_practica",
        "asignatura",
        "resolucion_numero",
        "created_at",
    )
    list_filter = ("asignatura__semestre",)
    search_fields = (
        "titulo",
        "codigo_interno",
        "asignatura__nombre",
        "asignatura__codigo_curricular",
    )
    list_select_related = ("asignatura", "asignatura__semestre")
