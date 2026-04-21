from decimal import Decimal

from django.db import models
from django.utils import timezone

from apps.estructura_academica.models import BaseModel


class Insumo(BaseModel):
    nombre = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)
    laboratorio = models.ForeignKey(
        "laboratorios.Laboratorio",
        on_delete=models.PROTECT,
        related_name="insumos",
    )
    unidad_medida = models.CharField(max_length=30)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=3)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=3)
    consumo_por_practica = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
    )
    merma_estimada_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    es_reactivo_quimico = models.BooleanField(default=False)
    requiere_control_especial = models.BooleanField(default=False)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    proveedor = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "Insumo"
        verbose_name_plural = "Insumos"

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    def stock_critico(self):
        return self.stock_actual <= self.stock_minimo

    def calcular_saldo_proyectado(self, num_practicas):
        if not self.consumo_por_practica:
            return self.stock_actual

        practicas = Decimal(str(num_practicas))
        factor_merma = Decimal("1") + (self.merma_estimada_pct / Decimal("100"))
        consumo_estimado = self.consumo_por_practica * practicas * factor_merma
        return self.stock_actual - consumo_estimado

    def dias_hasta_vencimiento(self):
        if not self.fecha_vencimiento:
            return None

        hoy = timezone.localdate()
        return (self.fecha_vencimiento - hoy).days
