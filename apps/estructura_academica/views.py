# App: estructura_academica | Archivo: views.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear ViewSets de solo lectura para los filtros en cascada jerárquicos.
# REGLA: Cada endpoint solo devuelve datos según el filtro de la selección anterior.
#
# 1. UnidadAcademicaViewSet (ReadOnlyModelViewSet):
#    - GET /api/v1/estructura/unidades/ → todas las unidades activas
#    - Permiso: IsAuthenticated
#
# 2. DepartamentoViewSet (ReadOnlyModelViewSet):
#    - GET /api/v1/estructura/departamentos/?unidad_id=X
#    - Filtrar obligatoriamente por unidad_academica_id desde query_params
#    - Si no se provee unidad_id: retornar 400 Bad Request
#
# 3. CarreraViewSet (ReadOnlyModelViewSet):
#    - GET /api/v1/estructura/carreras/?dept_id=X
#    - Filtrar por departamento_id
#
# 4. SemestreViewSet (ReadOnlyModelViewSet):
#    - GET /api/v1/estructura/semestres/ → lista fija del 1 al 10
#
# 5. AsignaturaViewSet (ReadOnlyModelViewSet):
#    - GET /api/v1/estructura/asignaturas/?carrera_id=X&semestre_id=Y&unidad_id=Z
#    - Los 3 parámetros son obligatorios: si falta alguno retornar 400
#    - Usar select_related para evitar N+1 queries
#
# Para todos los ViewSets: usar el serializer apropiado, IsAuthenticated,
# y django-filters para los filtros por query params

from django.shortcuts import render

# Create your views here.
