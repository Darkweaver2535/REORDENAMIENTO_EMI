# App: laboratorios | Archivo: urls.py

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from apps.laboratorios.views import (
    EquipoViewSet,
    LaboratorioViewSet,
    TipoEquipoViewSet,
)

app_name = "laboratorios"

router = SimpleRouter()
router.register(r"equipos", EquipoViewSet, basename="equipo")
router.register(r"tipos-equipo", TipoEquipoViewSet, basename="tipo-equipo")
router.register(r"", LaboratorioViewSet, basename="laboratorio")

urlpatterns = [
    path("", include(router.urls)),
]
