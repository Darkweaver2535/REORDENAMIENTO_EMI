# App: laboratorios | Archivo: admin.py
# TAREA: Registrar Laboratorio, Equipo y EquipoRequeridoPorGuia en Django Admin:
# - Laboratorio: list_display con nombre, unidad_academica, sala, capacidad_estudiantes
#   InlineAdmin para ver los equipos dentro del laboratorio (TabularInline)
# - Equipo: list_display con codigo_activo, nombre, laboratorio, cantidad_disponible,
#   estatus_general; list_filter por estatus_general y laboratorio__unidad_academica
#   Mostrar cantidad_disponible() como columna calculada con short_description
# - EquipoRequeridoPorGuia: list_display con guia, nombre_equipo_teorico,
#   equipo, cantidad_requerida, tiene_deficit

from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

from apps.laboratorios.models import (
    Equipo,
    EquipoRequeridoPorGuia,
    Laboratorio,
    TipoEquipo,
)


@admin.register(TipoEquipo)
class TipoEquipoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "total_equipos", "activo")
    list_filter = ("activo", "categoria")
    search_fields = ("nombre", "categoria")
    ordering = ("nombre",)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_n=Count("equipos"))

    @admin.display(description="Unidades", ordering="_n")
    def total_equipos(self, obj):
        return obj._n


class EquipoInline(admin.TabularInline):
    model = Equipo
    extra = 0
    fields = (
        "codigo_activo",
        "nombre",
        "cantidad_total",
        "cantidad_buena",
        "cantidad_regular",
        "cantidad_mala",
        "estatus_general",
    )
    show_change_link = True


@admin.register(Laboratorio)
class LaboratorioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "unidad_academica", "sala", "capacidad_estudiantes")
    list_select_related = ("unidad_academica",)
    search_fields = ("nombre", "sala", "campus", "unidad_academica__nombre")
    inlines = [EquipoInline]


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = (
        "codigo_activo",
        "nombre",
        "laboratorio",
        "cantidad_disponible_col",
        "estatus_general",
        "foto_preview_small",
    )
    list_filter = ("estatus_general", "unidad_academica")
    list_select_related = ("laboratorio", "laboratorio__unidad_academica")
    search_fields = ("codigo_activo", "nombre", "laboratorio__nombre")
    readonly_fields = ("foto_preview",)

    fieldsets = (
        (
            "Identificación",
            {
                "fields": ("nombre", "codigo_activo", "laboratorio"),
            },
        ),
        (
            "Cantidades",
            {
                "fields": (
                    "cantidad_total",
                    "cantidad_buena",
                    "cantidad_regular",
                    "cantidad_mala",
                    "estatus_general",
                ),
            },
        ),
        (
            "Ubicación y evaluación",
            {
                "fields": ("ubicacion_sala", "observaciones", "evaluado_en", "evaluado_por"),
            },
        ),
        (
            "Foto del equipo",
            {
                "fields": ("foto_preview", "foto_url"),
                "description": "Pega la URL pública de la imagen del equipo (Google Drive, Cloudinary, etc.)",
            },
        ),
        (
            "Especificaciones técnicas",
            {
                "fields": ("especificaciones",),
                "classes": ("collapse",),
                "description": 'Formato JSON clave-valor. Ejemplo: {"Procesador": "Intel i5", "RAM": "8 GB"}',
            },
        ),
        (
            "Notas adicionales",
            {
                "fields": ("notas",),
                "classes": ("collapse",),
            },
        ),
    )

    def cantidad_disponible_col(self, obj):
        return obj.cantidad_disponible()

    cantidad_disponible_col.short_description = "Cantidad disponible"

    def foto_preview(self, obj):
        if obj.foto_url:
            return format_html(
                '<img src="{}" style="max-height:120px; border-radius:6px;"/>',
                obj.foto_url,
            )
        return "Sin foto"

    foto_preview.short_description = "Vista previa"

    def foto_preview_small(self, obj):
        if obj.foto_url:
            return format_html(
                '<img src="{}" style="max-height:32px; border-radius:4px;"/>',
                obj.foto_url,
            )
        return "—"

    foto_preview_small.short_description = "Foto"

    def get_form(self, request, obj=None, **kwargs):
        # Guardamos el objeto actual en el request para poder consultarlo en formfield_for_foreignkey de forma robusta
        request._current_obj = obj
        return super().get_form(request, obj, **kwargs)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "laboratorio":
            from django.db.models import Q

            q = Q(hijos__isnull=True)
            # Si estamos editando, incluimos explícitamente el ID asignado actualmente
            obj = getattr(request, "_current_obj", None)
            if obj and obj.laboratorio_id:
                q |= Q(id=obj.laboratorio_id)
            kwargs["queryset"] = (
                db_field.related_model.objects.filter(q)
                .select_related("unidad_academica")
                .distinct()
            )
            kwargs["required"] = False
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(EquipoRequeridoPorGuia)
class EquipoRequeridoPorGuiaAdmin(admin.ModelAdmin):
    list_display = (
        "guia",
        "nombre_equipo_teorico",
        "equipo",
        "cantidad_requerida",
        "tiene_deficit_col",
    )
    list_select_related = ("guia", "equipo")
    search_fields = (
        "nombre_equipo_teorico",
        "guia__titulo",
        "equipo__nombre",
        "equipo__codigo_activo",
    )

    def tiene_deficit_col(self, obj):
        return obj.tiene_deficit()

    tiene_deficit_col.short_description = "Tiene déficit"
    tiene_deficit_col.boolean = True
