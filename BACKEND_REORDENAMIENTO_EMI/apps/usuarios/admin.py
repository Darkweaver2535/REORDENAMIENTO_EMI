from django.contrib import admin

from apps.usuarios.models import AuditLog, Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
	list_display = (
		"carnet_identidad",
		"nombre_completo",
		"rol",
		"unidad_academica",
		"is_active",
		"is_staff",
	)
	list_filter = ("rol", "unidad_academica", "is_active", "is_staff")
	search_fields = ("carnet_identidad", "nombre_completo", "email", "saga_username")
	list_select_related = ("unidad_academica",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
	list_display = ("timestamp", "accion", "tabla_afectada", "registro_id", "usuario", "ip_address")
	list_filter = ("accion", "tabla_afectada")
	search_fields = ("tabla_afectada", "registro_id", "usuario__nombre_completo", "usuario__carnet_identidad")
	list_select_related = ("usuario",)
	readonly_fields = ("timestamp",)
