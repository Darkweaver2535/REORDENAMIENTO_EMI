from rest_framework.routers import DefaultRouter

from apps.mantenimientos.views import RegistroMantenimientoViewSet

router = DefaultRouter()
router.register(r"mantenimientos", RegistroMantenimientoViewSet, basename="mantenimiento")

urlpatterns = router.urls
