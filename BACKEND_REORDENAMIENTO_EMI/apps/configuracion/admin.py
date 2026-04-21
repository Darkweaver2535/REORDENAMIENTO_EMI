from django.contrib import admin

from apps.configuracion.models import ConfiguracionSistema


@admin.register(ConfiguracionSistema)
class ConfiguracionSistemaAdmin(admin.ModelAdmin):
    list_display = ["nombre_sistema", "version", "modulo_reactivos_activo", "updated_at"]
    readonly_fields = ["updated_at"]

    def has_add_permission(self, request):
        # Solo 1 registro permitido
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False
