from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.usuarios.views import PerfilView, UsuarioAdminViewSet

app_name = "usuarios"

router = DefaultRouter()
router.register(r"", UsuarioAdminViewSet, basename="usuarios")

urlpatterns = [
	path("perfil/", PerfilView.as_view(), name="perfil"),
	path("", include(router.urls)),
]
