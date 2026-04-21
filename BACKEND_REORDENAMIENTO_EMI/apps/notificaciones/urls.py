from rest_framework.routers import DefaultRouter

from apps.notificaciones.views import NotificacionViewSet

app_name = "notificaciones"

router = DefaultRouter()
router.register(r"", NotificacionViewSet, basename="notificaciones")

urlpatterns = router.urls
