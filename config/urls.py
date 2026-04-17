# Sistema de gestión de laboratorios universitarios
# TAREA: Crear el archivo urls.py principal del proyecto que incluya:
# 1. Prefijo global /api/v1/ para todas las rutas de la API
# 2. Incluir las URLs de cada app: usuarios, estructura_academica, guias,
#    laboratorios, reordenamiento
# 3. Rutas de JWT: /api/v1/auth/token/ y /api/v1/auth/token/refresh/
# 4. Ruta del Django Admin en /admin/
# 5. Comentar claramente la responsabilidad de cada include

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # Panel administrativo de Django.
    path("admin/", admin.site.urls),

    # Autenticacion JWT para clientes API.
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # API v1 - Gestion de usuarios y autenticacion del sistema.
    path("api/v1/usuarios/", include("apps.usuarios.urls")),

    # API v1 - Estructura academica (facultades, carreras, asignaturas, etc.).
    path("api/v1/estructura-academica/", include("apps.estructura_academica.urls")),

    # API v1 - Gestion de guias de practicas.
    path("api/v1/guias/", include("apps.guias.urls")),

    # API v1 - Gestion de laboratorios e inventario asociado.
    path("api/v1/laboratorios/", include("apps.laboratorios.urls")),

    # API v1 - Procesos de reordenamiento y traslados de equipos.
    path("api/v1/reordenamiento/", include("apps.reordenamiento.urls")),
]
