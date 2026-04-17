# config/urls.py | ACTUALIZAR el archivo existente
# TAREA: Incluir TODAS las URLs de las apps con el prefijo correcto
#
# urlpatterns = [
#   path('admin/', admin.site.urls),
#   path('api/v1/auth/', include('usuarios.urls')),
#   path('api/v1/estructura/', include('estructura_academica.urls')),
#   path('api/v1/', include('guias.urls')),
#   path('api/v1/', include('laboratorios.urls')),
#   path('api/v1/', include('reordenamiento.urls')),
#   # JWT tokens
#   path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
#   path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
# ]

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.usuarios.views import LoginView, PerfilView

urlpatterns = [
    # Panel administrativo de Django.
    path("admin/", admin.site.urls),

    # Autenticacion JWT para clientes API.
    path("api/v1/auth/login/", LoginView.as_view(), name="login"),
    path("api/v1/auth/perfil/", PerfilView.as_view(), name="perfil"),
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
