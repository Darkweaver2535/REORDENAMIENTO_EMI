from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.usuarios.views import LoginView, PerfilView

API_PREFIX = "api/v1/"


urlpatterns = [
    # Panel administrativo de Django
    path("admin/", admin.site.urls),
    # Documentación de API (#6): schema OpenAPI + Swagger UI + ReDoc
    path(f"{API_PREFIX}schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        f"{API_PREFIX}docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        f"{API_PREFIX}redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    # Auth (Autenticación JWT y Perfil)
    path(f"{API_PREFIX}auth/login/", LoginView.as_view(), name="login"),
    path(f"{API_PREFIX}auth/perfil/", PerfilView.as_view(), name="perfil"),
    path(f"{API_PREFIX}auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path(f"{API_PREFIX}auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Usuarios (Gestión)
    path(f"{API_PREFIX}usuarios/", include("apps.usuarios.urls")),
    # Estructura Académica (Con guión bajo como estándar de Django)
    path(f"{API_PREFIX}estructura_academica/", include("apps.estructura_academica.urls")),
    # Guías
    path(f"{API_PREFIX}guias/", include("apps.guias.urls")),
    # Laboratorios
    path(f"{API_PREFIX}laboratorios/", include("apps.laboratorios.urls")),
    # Reordenamientos (Plural para coincidir con el frontend)
    path(f"{API_PREFIX}reordenamientos/", include("apps.reordenamiento.urls")),
    # Reactivos (Modulo preparado)
    path(f"{API_PREFIX}reactivos/", include("apps.reactivos.urls")),
    # Dashboard
    path(f"{API_PREFIX}dashboard/", include("apps.dashboard.urls")),
    # Notificaciones
    path(f"{API_PREFIX}notificaciones/", include("apps.notificaciones.urls")),
    # Reportes
    path(f"{API_PREFIX}reportes/", include("apps.reportes.urls")),
    # Configuración
    path(f"{API_PREFIX}configuracion/", include("apps.configuracion.urls")),
    # Evaluaciones
    path(f"{API_PREFIX}", include("apps.evaluaciones.urls")),
    # Mantenimientos (Bitácora)
    path(f"{API_PREFIX}", include("apps.mantenimientos.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
