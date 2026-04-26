# App: estructura_academica | Archivo: admin.py
from django.contrib import admin

from apps.estructura_academica.models import (
	Asignatura,
	Carrera,
	CarreraUnidadAcademica,
	Departamento,
	Semestre,
	UnidadAcademica,
)


@admin.register(UnidadAcademica)
class UnidadAcademicaAdmin(admin.ModelAdmin):
	list_display = ("nombre", "ciudad", "codigo", "abreviacion", "is_active")
	search_fields = ("nombre", "ciudad", "codigo")


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo", "unidad_academica")
	list_filter = ("unidad_academica",)
	search_fields = ("nombre", "codigo")
	list_select_related = ("unidad_academica",)


class CarreraUnidadAcademicaInline(admin.TabularInline):
	model = CarreraUnidadAcademica
	extra = 1
	fields = ("unidad_academica", "is_active")
	verbose_name = "Sede"
	verbose_name_plural = "Sedes donde existe esta carrera"


@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo_institucional", "departamento", "sedes_activas")
	search_fields = ("nombre", "codigo_institucional")
	list_select_related = ("departamento",)
	inlines = [CarreraUnidadAcademicaInline]

	def sedes_activas(self, obj):
		sedes = obj.unidades_academicas.filter(
			carreraunidadacademica__is_active=True
		)
		return ", ".join(s.nombre for s in sedes) or "—"

	sedes_activas.short_description = "Sedes activas"


@admin.register(Semestre)
class SemestreAdmin(admin.ModelAdmin):
	list_display = ("numero", "nombre")
	search_fields = ("nombre",)


@admin.register(Asignatura)
class AsignaturaAdmin(admin.ModelAdmin):
	list_display = (
		"nombre",
		"codigo_curricular",
		"carrera",
		"semestre",
		"unidad_academica",
		"is_active",
	)
	list_filter = ("semestre", "unidad_academica")
	search_fields = ("nombre", "codigo_curricular")
	list_select_related = ("carrera", "semestre", "unidad_academica")


@admin.register(CarreraUnidadAcademica)
class CarreraUnidadAcademicaAdmin(admin.ModelAdmin):
	list_display = ("carrera", "unidad_academica", "is_active")
	list_filter = ("unidad_academica", "is_active")
	search_fields = ("carrera__nombre", "carrera__codigo_institucional", "unidad_academica__codigo")
	list_select_related = ("carrera", "unidad_academica")
	list_editable = ("is_active",)
