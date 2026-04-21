# App: usuarios | Archivo: signals.py
# Sistema de gestión de laboratorios universitarios - Django Signals
#
# TAREA: Crear señales Django para auditoría automática de cambios críticos.
# Conectar usando @receiver decorador.
#
# 1. Signal post_save en modelo Guia:
#    Cuando estado cambia a 'publicado': registrar AuditLog con accion='PUBLISH'
#    Cuando estado cambia a 'pendiente': registrar AuditLog con accion='UPDATE'
#
# 2. Signal post_save en modelo Reordenamiento:
#    Cuando estado cambia a 'autorizado': registrar AuditLog con accion='APPROVE'
#    Cuando estado cambia a 'ejecutado': registrar AuditLog con accion='MOVE'
#
# 3. Signal post_save en modelo Equipo:
#    Cuando laboratorio_id cambia: registrar AuditLog con accion='MOVE'
#    Incluir datos_anteriores={lab_anterior} y datos_nuevos={lab_nuevo}
#    Invalidar caché Redis del laboratorio afectado
#
# Recordar registrar las señales en el método ready() del AppConfig en apps.py
# de la app usuarios (o en cada app correspondiente)

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.guias.models import Guia
from apps.laboratorios.models import Equipo
from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.usuarios.models import AuditLog


@receiver(pre_save, sender=Guia)
def guia_pre_save_track_estado(sender, instance, **kwargs):
	if not instance.pk:
		instance._estado_previo_signal = None
		return

	try:
		previo = Guia.objects.only("estado").get(pk=instance.pk)
		instance._estado_previo_signal = previo.estado
	except Guia.DoesNotExist:
		instance._estado_previo_signal = None


@receiver(post_save, sender=Guia)
def guia_post_save_audit_estado(sender, instance, created, **kwargs):
	if created:
		return

	estado_previo = getattr(instance, "_estado_previo_signal", None)
	if estado_previo == instance.estado:
		return

	if instance.estado == Guia.Estado.PUBLICADO:
		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=instance.id,
			accion=AuditLog.Accion.PUBLISH,
			usuario=instance.aprobado_por,
			datos_anteriores={"estado": estado_previo},
			datos_nuevos={"estado": instance.estado},
		)
	elif instance.estado == Guia.Estado.PENDIENTE:
		AuditLog.objects.create(
			tabla_afectada="Guia",
			registro_id=instance.id,
			accion=AuditLog.Accion.UPDATE,
			usuario=None,
			datos_anteriores={"estado": estado_previo},
			datos_nuevos={"estado": instance.estado},
		)


@receiver(pre_save, sender=Reordenamiento)
def reordenamiento_pre_save_track_estado(sender, instance, **kwargs):
	if not instance.pk:
		instance._estado_previo_signal = None
		return

	try:
		previo = Reordenamiento.objects.only("estado").get(pk=instance.pk)
		instance._estado_previo_signal = previo.estado
	except Reordenamiento.DoesNotExist:
		instance._estado_previo_signal = None


@receiver(post_save, sender=Reordenamiento)
def reordenamiento_post_save_audit_estado(sender, instance, created, **kwargs):
	if created:
		return

	estado_previo = getattr(instance, "_estado_previo_signal", None)
	if estado_previo == instance.estado:
		return

	if instance.estado == Reordenamiento.Estado.AUTORIZADO:
		AuditLog.objects.create(
			tabla_afectada="Reordenamiento",
			registro_id=instance.id,
			accion=AuditLog.Accion.APPROVE,
			usuario=instance.autorizado_por,
			datos_anteriores={"estado": estado_previo},
			datos_nuevos={"estado": instance.estado},
		)
	elif instance.estado == Reordenamiento.Estado.EJECUTADO:
		AuditLog.objects.create(
			tabla_afectada="Reordenamiento",
			registro_id=instance.id,
			accion=AuditLog.Accion.MOVE,
			usuario=instance.ejecutado_por,
			datos_anteriores={"estado": estado_previo},
			datos_nuevos={"estado": instance.estado},
		)


@receiver(pre_save, sender=Equipo)
def equipo_pre_save_track_laboratorio(sender, instance, **kwargs):
	if not instance.pk:
		instance._lab_previo_signal = None
		return

	try:
		previo = Equipo.objects.only("laboratorio_id").get(pk=instance.pk)
		instance._lab_previo_signal = previo.laboratorio_id
	except Equipo.DoesNotExist:
		instance._lab_previo_signal = None


@receiver(post_save, sender=Equipo)
def equipo_post_save_audit_movimiento(sender, instance, created, **kwargs):
	lab_previo = getattr(instance, "_lab_previo_signal", None)
	lab_nuevo = instance.laboratorio_id

	if lab_previo and lab_previo != lab_nuevo:
		AuditLog.objects.create(
			tabla_afectada="Equipo",
			registro_id=instance.id,
			accion=AuditLog.Accion.MOVE,
			usuario=instance.evaluado_por,
			datos_anteriores={"lab_anterior": lab_previo},
			datos_nuevos={"lab_nuevo": lab_nuevo},
		)

		InventoryAnalyticsService.invalidar_cache_laboratorio(lab_previo)
		InventoryAnalyticsService.invalidar_cache_laboratorio(lab_nuevo)
