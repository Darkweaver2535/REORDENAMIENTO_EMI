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


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
	list_display = (
		"codigo_activo",
		"nombre",
		"laboratorio",
		"cantidad_disponible_col",
		"estatus_general",
	)
	list_filter = ("estatus_general", "laboratorio__unidad_academica")
	list_select_related = ("laboratorio", "laboratorio__unidad_academica")
	search_fields = ("codigo_activo", "nombre", "laboratorio__nombre")

	def cantidad_disponible_col(self, obj):
		return obj.cantidad_disponible()

	cantidad_disponible_col.short_description = "Cantidad disponible"


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
