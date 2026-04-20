from django.conf import settings
from django.db import models


class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        REORDENAMIENTO = "REORDENAMIENTO", "Nuevo Reordenamiento Pendiente"
        AUTORIZACION = "AUTORIZACION", "Reordenamiento Autorizado"
        EVALUACION = "EVALUACION", "Equipo evaluado con estado crítico"
        SISTEMA = "SISTEMA", "Mensaje del sistema"

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificaciones",
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    mensaje = models.TextField()
    leida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    # Referencia genérica opcional al objeto relacionado
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    objeto_url = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"

    def __str__(self):
        return f"[{self.tipo}] {self.usuario} — {self.mensaje[:60]}"
