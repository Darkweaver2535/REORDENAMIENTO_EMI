# App: estructura_academica | Archivo: admin.py
# TAREA: Registrar todos los modelos en el Django Admin con configuración amigable:
# - UnidadAcademia: list_display con nombre, ciudad, codigo; search_fields
# - Departamento: list_display, list_filter por unidad_academica
# - Carrera: list_display con codigo_institucional; search por nombre y codigo
# - Asignatura: list_display con codigo_curricular, carrera, semestre, unidad_academica
#   list_filter por semestre y unidad_academica; search por nombre y codigo_curricular
# Usar list_select_related=True donde corresponda para evitar N+1 queries

from django.contrib import admin

# Register your models here.
