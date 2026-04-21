from django.contrib import admin

from apps.notificaciones.models import Notificacion


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["id", "usuario", "tipo", "leida", "created_at"]
    list_filter = ["tipo", "leida"]
    search_fields = ["usuario__username", "mensaje"]
    ordering = ["-created_at"]
