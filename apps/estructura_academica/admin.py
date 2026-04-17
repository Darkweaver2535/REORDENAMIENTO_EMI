# App: estructura_academica | Archivo: admin.py
# TAREA: Registrar todos los modelos en el Django Admin con configuración amigable:
# - UnidadAcademia: list_display con nombre, ciudad, codigo; search_fields
# - Departamento: list_display, list_filter por unidad_academica
# - Carrera: list_display con codigo_institucional; search por nombre y codigo
# - Asignatura: list_display con codigo_curricular, carrera, semestre, unidad_academica
#   list_filter por semestre y unidad_academica; search por nombre y codigo_curricular
# Usar list_select_related=True donde corresponda para evitar N+1 queries

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
	list_display = ("nombre", "ciudad", "codigo", "is_active")
	search_fields = ("nombre", "ciudad", "codigo")


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo", "unidad_academica")
	list_filter = ("unidad_academica",)
	search_fields = ("nombre", "codigo")
	list_select_related = ("unidad_academica",)


@admin.register(Carrera)
class CarreraAdmin(admin.ModelAdmin):
	list_display = ("nombre", "codigo_institucional", "departamento")
	search_fields = ("nombre", "codigo_institucional")
	list_select_related = ("departamento",)


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
