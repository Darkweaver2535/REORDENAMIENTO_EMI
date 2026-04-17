from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.guias.views import GuiaViewSet

app_name = "guias"

router = DefaultRouter()
router.register("", GuiaViewSet, basename="guia")

urlpatterns = [
	path("", include(router.urls)),
]
