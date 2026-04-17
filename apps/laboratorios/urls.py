# App: laboratorios | Archivo: urls.py
# TAREA: Registrar LaboratorioViewSet y EquipoViewSet
#
# router.register('laboratorios', LaboratorioViewSet, basename='laboratorio')
# router.register('equipos', EquipoViewSet, basename='equipo')
# Esto genera automáticamente:
# GET  /api/v1/laboratorios/{id}/analytics/
# PATCH /api/v1/equipos/{id}/evaluacion-insitu/

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.laboratorios.views import LaboratorioViewSet, EquipoViewSet

app_name = "laboratorios"

router = DefaultRouter()
router.register("laboratorios", LaboratorioViewSet, basename="laboratorio")
router.register("equipos", EquipoViewSet, basename="equipo")

urlpatterns = [
	path("", include(router.urls)),
]
