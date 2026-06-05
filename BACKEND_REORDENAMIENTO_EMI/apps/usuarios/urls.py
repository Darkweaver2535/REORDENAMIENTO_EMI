from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.usuarios.views import AuditLogViewSet, PerfilView, UsuarioAdminViewSet

app_name = "usuarios"

router = DefaultRouter()
# El router de auditoría se registra antes que el catch-all r"" de usuarios.
router.register(r"auditoria", AuditLogViewSet, basename="auditoria")
router.register(r"", UsuarioAdminViewSet, basename="usuarios")

urlpatterns = [
    path("perfil/", PerfilView.as_view(), name="perfil"),
    path("", include(router.urls)),
]
