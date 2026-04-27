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

from apps.laboratorios.models import Equipo, EquipoRequeridoPorGuia, Laboratorio


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


from django.utils.html import format_html


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
	list_filter = ("estatus_general", "laboratorio__unidad_academica")
	list_select_related = ("laboratorio", "laboratorio__unidad_academica")
	search_fields = ("codigo_activo", "nombre", "laboratorio__nombre")
	readonly_fields = ("foto_preview",)

	fieldsets = (
		("Identificación", {
			"fields": ("nombre", "codigo_activo", "laboratorio"),
		}),
		("Cantidades", {
			"fields": ("cantidad_total", "cantidad_buena", "cantidad_regular", "cantidad_mala", "estatus_general"),
		}),
		("Ubicación y evaluación", {
			"fields": ("ubicacion_sala", "observaciones", "evaluado_en", "evaluado_por"),
		}),
		("Foto del equipo", {
			"fields": ("foto_preview", "foto_url"),
			"description": "Pega la URL pública de la imagen del equipo (Google Drive, Cloudinary, etc.)",
		}),
		("Especificaciones técnicas", {
			"fields": ("especificaciones",),
			"classes": ("collapse",),
			"description": "Formato JSON clave-valor. Ejemplo: {\"Procesador\": \"Intel i5\", \"RAM\": \"8 GB\"}",
		}),
		("Notas adicionales", {
			"fields": ("notas",),
			"classes": ("collapse",),
		}),
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
	search_fields = ("nombre_equipo_teorico", "guia__titulo", "equipo__nombre", "equipo__codigo_activo")

	def tiene_deficit_col(self, obj):
		return obj.tiene_deficit()

	tiene_deficit_col.short_description = "Tiene déficit"
	tiene_deficit_col.boolean = True
