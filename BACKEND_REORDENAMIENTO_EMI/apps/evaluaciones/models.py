from django.db import models
from django.core.exceptions import ValidationError

from apps.estructura_academica.models import BaseModel


class Evaluacion(BaseModel):
    """
    Evaluación in-situ de un equipo de laboratorio.
    Un equipo puede tener N unidades físicas (ej: 4 balanzas).
    Esta evaluación registra cuántas están en cada condición.
    """

    equipo = models.ForeignKey(
        "laboratorios.Equipo",
        on_delete=models.CASCADE,
        related_name="evaluaciones",
        verbose_name="Equipo evaluado",
    )
    evaluador = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluaciones_realizadas",
        verbose_name="Evaluador",
    )
    laboratorio = models.ForeignKey(
        "laboratorios.Laboratorio",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluaciones",
        verbose_name="Laboratorio",
    )

    # ── Distribución por condición ──────────────────
    cantidad_bueno = models.PositiveIntegerField(
        default=0, verbose_name="Unidades en buen estado"
    )
    cantidad_regular = models.PositiveIntegerField(
        default=0, verbose_name="Unidades en estado regular"
    )
    cantidad_malo = models.PositiveIntegerField(
        default=0, verbose_name="Unidades en mal estado"
    )

    observaciones = models.TextField(
        blank=True, default="", verbose_name="Observaciones generales"
    )
    fecha = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de evaluación"
    )

    class Meta:
        verbose_name = "Evaluación"
        verbose_name_plural = "Evaluaciones"
        ordering = ["-fecha"]

    def clean(self):
        total = self.cantidad_bueno + self.cantidad_regular + self.cantidad_malo
        if total == 0:
            raise ValidationError("Debe clasificar al menos una unidad.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def total_unidades(self):
        return self.cantidad_bueno + self.cantidad_regular + self.cantidad_malo

    @property
    def condicion_predominante(self):
        """Condición del mayor grupo."""
        maxval = max(self.cantidad_bueno, self.cantidad_regular, self.cantidad_malo)
        if maxval == self.cantidad_bueno:
            return "bueno"
        if maxval == self.cantidad_regular:
            return "regular"
        return "malo"

    @property
    def porcentaje_bueno(self):
        if self.total_unidades == 0:
            return 0
        return round((self.cantidad_bueno / self.total_unidades) * 100)

    def __str__(self):
        fecha_str = self.fecha.strftime("%d/%m/%Y") if self.fecha else "sin fecha"
        return f"Evaluación de {self.equipo} — {fecha_str}"
