from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.laboratorios.models import Equipo
from apps.laboratorios.services import InventoryAnalyticsService


@receiver(pre_save, sender=Equipo)
def equipo_pre_save_track_laboratorio(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        previous = Equipo.objects.only("laboratorio_id").get(pk=instance.pk)
        instance._previous_laboratorio_id = previous.laboratorio_id
    except Equipo.DoesNotExist:
        instance._previous_laboratorio_id = None


@receiver(post_save, sender=Equipo)
def equipo_post_save_invalidate_cache(sender, instance, **kwargs):
    InventoryAnalyticsService.invalidar_cache_laboratorio(instance.laboratorio_id)

    previous_lab_id = getattr(instance, "_previous_laboratorio_id", None)
    if previous_lab_id and previous_lab_id != instance.laboratorio_id:
        InventoryAnalyticsService.invalidar_cache_laboratorio(previous_lab_id)


@receiver(post_delete, sender=Equipo)
def equipo_post_delete_invalidate_cache(sender, instance, **kwargs):
    InventoryAnalyticsService.invalidar_cache_laboratorio(instance.laboratorio_id)
