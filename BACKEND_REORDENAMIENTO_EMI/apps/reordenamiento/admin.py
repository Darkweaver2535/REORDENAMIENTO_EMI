from django.contrib import admin

from apps.reordenamiento.models import Reordenamiento


@admin.register(Reordenamiento)
class ReordenamientoAdmin(admin.ModelAdmin):
	list_display = (
		"id",
		"equipo",
		"laboratorio_origen",
		"laboratorio_destino",
		"cantidad_trasladada",
		"estado",
		"resolucion_numero",
		"fecha_autorizacion",
		"fecha_ejecucion",
	)
	list_filter = ("estado", "laboratorio_origen__unidad_academica", "laboratorio_destino__unidad_academica")
	search_fields = (
		"equipo__codigo_activo",
		"equipo__nombre",
		"resolucion_numero",
		"laboratorio_origen__nombre",
		"laboratorio_destino__nombre",
	)
	list_select_related = (
		"equipo",
		"laboratorio_origen",
		"laboratorio_destino",
		"autorizado_por",
		"ejecutado_por",
	)
