from django.contrib import admin

from apps.mantenimientos.models import RegistroMantenimiento


@admin.register(RegistroMantenimiento)
class RegistroMantenimientoAdmin(admin.ModelAdmin):
	list_display = ("equipo", "tipo", "estado", "fecha_realizacion", "realizado_por", "fecha_proximo")
	list_filter = ("tipo", "estado")
	search_fields = ("equipo__nombre", "equipo__codigo_activo", "descripcion")
	date_hierarchy = "fecha_realizacion"
	raw_id_fields = ("equipo", "realizado_por")
