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

# Register your models here.
