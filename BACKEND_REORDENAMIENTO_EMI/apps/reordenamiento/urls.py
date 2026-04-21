# App: reordenamiento | Archivo: urls.py
# TAREA: Registrar ReordenamientoViewSet
#
# router.register('reordenamientos', ReordenamientoViewSet, basename='reordenamiento')
# Esto genera:
# POST  /api/v1/reordenamientos/
# POST  /api/v1/reordenamientos/{id}/autorizar/
# POST  /api/v1/reordenamientos/{id}/ejecutar/
# GET   /api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=Balanza

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.reordenamiento.views import ReordenamientoViewSet

app_name = "reordenamiento"

router = DefaultRouter()
router.register(r"", ReordenamientoViewSet, basename="reordenamiento")

urlpatterns = [
	path("", include(router.urls)),
]
