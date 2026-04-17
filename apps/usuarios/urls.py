from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.usuarios.views import ListaUsuariosView, PerfilView

app_name = "usuarios"

router = DefaultRouter()

urlpatterns = [
	path("", include(router.urls)),
	path("", ListaUsuariosView.as_view(), name="usuarios-lista"),
	path("perfil/", PerfilView.as_view(), name="perfil"),
]
