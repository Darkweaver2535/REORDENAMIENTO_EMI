from django.contrib import admin
from django.utils.html import format_html

from apps.reordenamiento.models import Reordenamiento


@admin.register(Reordenamiento)
class ReordenamientoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tipo_movimiento",
        "equipo",
        "laboratorio_origen",
        "laboratorio_destino",
        "cantidad_trasladada",
        "estado",
        "numero_documento",
        "tiene_documento_col",
        "fecha_recepcion",
    )
    list_filter = (
        "tipo_movimiento",
        "estado",
        "laboratorio_origen__unidad_academica",
        "laboratorio_destino__unidad_academica",
    )
    search_fields = (
        "equipo__codigo_activo",
        "equipo__nombre",
        "numero_documento",
        "resolucion_numero",
        "laboratorio_origen__nombre",
        "laboratorio_destino__nombre",
    )
    list_select_related = (
        "equipo",
        "laboratorio_origen",
        "laboratorio_destino",
        "aprobado_por",
        "autorizado_por",
        "ejecutado_por",
        "recepcionado_por",
    )
    readonly_fields = ("documento_preview", "resolucion_numero")
    fieldsets = (
        (
            "Tipo y estado",
            {
                "fields": ("tipo_movimiento", "estado"),
            },
        ),
        (
            "Origen y destino",
            {
                "fields": (
                    "equipo",
                    "laboratorio_origen",
                    "laboratorio_destino",
                    "cantidad_trasladada",
                    "motivo",
                ),
            },
        ),
        (
            "Documentación",
            {
                "fields": (
                    "numero_documento",
                    "resolucion_numero",
                    "tipo_documento",
                    "documento_respaldo",
                    "documento_preview",
                    "pdf_reporte_url",
                ),
            },
        ),
        (
            "Fecha de retorno (solo préstamos)",
            {
                "fields": ("fecha_retorno_prevista",),
                "classes": ("collapse",),
            },
        ),
        (
            "Aprobación",
            {
                "fields": ("aprobado_por", "autorizado_por", "fecha_autorizacion"),
                "classes": ("collapse",),
            },
        ),
        (
            "Ejecución",
            {
                "fields": ("ejecutado_por", "fecha_ejecucion"),
                "classes": ("collapse",),
            },
        ),
        (
            "Recepción",
            {
                "fields": ("recepcionado_por", "fecha_recepcion", "observaciones_recepcion"),
            },
        ),
    )

    def get_form(self, request, obj=None, **kwargs):
        request._current_obj = obj
        return super().get_form(request, obj, **kwargs)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        from django.db.models import Q

        from apps.laboratorios.models import Laboratorio

        if db_field.name in ["laboratorio_origen", "laboratorio_destino"]:
            q = Q(hijos__isnull=True)
            obj = getattr(request, "_current_obj", None)
            if obj:
                if db_field.name == "laboratorio_origen" and obj.laboratorio_origen_id:
                    q |= Q(id=obj.laboratorio_origen_id)
                elif db_field.name == "laboratorio_destino" and obj.laboratorio_destino_id:
                    q |= Q(id=obj.laboratorio_destino_id)
            kwargs["queryset"] = (
                Laboratorio.objects.filter(q).select_related("unidad_academica").distinct()
            )

        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def tiene_documento_col(self, obj):
        if obj.documento_respaldo:
            return format_html(
                '<a href="{}" target="_blank" style="color:#2563eb;font-weight:700;">📄 Ver</a>',
                obj.documento_respaldo.url,
            )
        from django.utils.safestring import mark_safe

        return mark_safe('<span style="color:#9ca3af;">—</span>')

    tiene_documento_col.short_description = "Documento"

    def documento_preview(self, obj):
        if not obj.documento_respaldo:
            return "Sin documento adjunto"
        nombre = str(obj.documento_respaldo.name).rsplit("/", 1)[-1]
        url = obj.documento_respaldo.url
        ext = nombre.lower().rsplit(".", 1)[-1]
        if ext in {"jpg", "jpeg", "png"}:
            return format_html(
                '<a href="{url}" target="_blank">'
                '<img src="{url}" style="max-height:120px;border-radius:6px;margin-bottom:6px;"><br>{nombre}</a>',
                url=url,
                nombre=nombre,
            )
        return format_html(
            '<a href="{}" target="_blank" style="color:#2563eb;font-weight:700;">{}</a>',
            url,
            nombre,
        )

    documento_preview.short_description = "Vista previa del documento"
