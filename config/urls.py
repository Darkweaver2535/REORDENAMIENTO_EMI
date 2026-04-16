# Sistema de gestión de laboratorios universitarios
# TAREA: Crear el archivo urls.py principal del proyecto que incluya:
# 1. Prefijo global /api/v1/ para todas las rutas de la API
# 2. Incluir las URLs de cada app: usuarios, estructura_academica, guias,
#    laboratorios, reordenamiento
# 3. Rutas de JWT: /api/v1/auth/token/ y /api/v1/auth/token/refresh/
# 4. Ruta del Django Admin en /admin/
# 5. Comentar claramente la responsabilidad de cada include

from django.contrib import admin
from django.urls import path

urlpatterns = [
    path('admin/', admin.site.urls),
]
