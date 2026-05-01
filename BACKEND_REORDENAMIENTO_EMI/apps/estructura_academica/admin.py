# App: estructura_academica | Archivo: admin.py
from django.contrib import admin

from apps.estructura_academica.models import (
	Asignatura,
	Carrera,
	CarreraUnidadAcademica,
	Departamento,
	DepartamentoUnidadAcademica,
	Semestre,
	UnidadAcademica,
)


@admin.register(UnidadAcademica)
class UnidadAcademicaAdmin(admin.ModelAdmin):
	list_display = ("nombre", "ciudad", "codigo", "abreviacion", "is_active")
	search_fields = ("nombre", "ciudad", "codigo")


# ── Departamento ──────────────────────────────────────────────────


class DepartamentoUnidadAcademicaInline(admin.TabularInline):
	model = DepartamentoUnidadAcademica
	extra = 1
	fields = ("unidad_academica", "is_active")
	verbose_name = "Unidad Académica"
	verbose_name_plural = "Unidades Académicas donde existe este departamento"


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo", "unidades_activas")
	search_fields = ("nombre", "codigo")
	inlines = [DepartamentoUnidadAcademicaInline]

	def unidades_activas(self, obj):
		return ", ".join(
			r.unidad_academica.nombre
			for r in obj.depto_sedes.filter(is_active=True).select_related("unidad_academica")
		) or "—"

	unidades_activas.short_description = "Unidades Académicas activas"


@admin.register(DepartamentoUnidadAcademica)
class DepartamentoUnidadAcademicaAdmin(admin.ModelAdmin):
	list_display = ("departamento", "unidad_academica", "is_active")
	list_filter = ("unidad_academica", "is_active")
	search_fields = ("departamento__nombre", "unidad_academica__codigo")
	list_select_related = ("departamento", "unidad_academica")
	list_editable = ("is_active",)


# ── Carrera ───────────────────────────────────────────────────────


class CarreraUnidadAcademicaInline(admin.TabularInline):
	model = CarreraUnidadAcademica
	extra = 1
	fields = ("unidad_academica", "is_active")
	verbose_name = "Unidad Académica"
	verbose_name_plural = "Unidades Académicas donde existe esta carrera"


@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo_institucional", "departamento", "unidades_activas")
	search_fields = ("nombre", "codigo_institucional")
	list_select_related = ("departamento",)
	inlines = [CarreraUnidadAcademicaInline]

	def unidades_activas(self, obj):
		return ", ".join(
			r.unidad_academica.nombre
			for r in obj.carrera_sedes.filter(is_active=True).select_related("unidad_academica")
		) or "—"

	unidades_activas.short_description = "Unidades Académicas activas"


@admin.register(CarreraUnidadAcademica)
class CarreraUnidadAcademicaAdmin(admin.ModelAdmin):
	list_display = ("carrera", "unidad_academica", "is_active")
	list_filter = ("unidad_academica", "is_active")
	search_fields = ("carrera__nombre", "carrera__codigo_institucional", "unidad_academica__codigo")
	list_select_related = ("carrera", "unidad_academica")
	list_editable = ("is_active",)


# ── Semestre y Asignatura ─────────────────────────────────────────


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
		"is_active",
	)
	list_filter = ("semestre", "carrera")
	search_fields = ("nombre", "codigo_curricular")
	list_select_related = ("carrera", "semestre")
