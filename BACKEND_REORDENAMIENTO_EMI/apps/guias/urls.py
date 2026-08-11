# App: guias | Archivo: urls.py
# TAREA: Registrar GuiaViewSet y EquipoRequeridoViewSet
#
# router.register('guias', GuiaViewSet, basename='guia')
# router.register('equipos-requeridos', EquipoRequeridoViewSet, basename='equiporequerido')
# Prefix: path('api/v1/', include('guias.urls'))
# Esto genera automáticamente:
# GET/POST   /api/v1/guias/
# GET/PUT    /api/v1/guias/{id}/
# POST       /api/v1/guias/{id}/solicitar-aprobacion/
# POST       /api/v1/guias/{id}/publicar/
# POST       /api/v1/guias/{id}/rechazar/

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.guias.views import EquipoRequeridoViewSet, GuiaViewSet

app_name = "guias"

router = DefaultRouter()
# El orden importa: GuiaViewSet vive en el prefijo vacío, así que su ruta de
# detalle es `^(?P<pk>[^/.]+)/$` y se traga cualquier sub-ruta que venga
# después. Registrada al final, /guias/equipos-requeridos/ se resolvía como
# "la guía con id 'equipos-requeridos'" y respondía 404. Va antes.
router.register("equipos-requeridos", EquipoRequeridoViewSet, basename="equipo-requerido")
router.register("", GuiaViewSet, basename="guia")

urlpatterns = [
    path("", include(router.urls)),
]
