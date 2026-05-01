# App: reordenamiento | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear el modelo 'Reordenamiento' que registra el movimiento oficial
# de equipos entre laboratorios (puede ser entre unidades académicas diferentes).
# Hereda de BaseModel (created_at, updated_at).
#
# Campos:
# - equipo: ForeignKey('laboratorios.Equipo', on_delete=PROTECT, related_name='reordenamientos')
# - laboratorio_origen: ForeignKey('laboratorios.Laboratorio', on_delete=PROTECT,
#   related_name='reordenamientos_origen')
# - laboratorio_destino: ForeignKey('laboratorios.Laboratorio', on_delete=PROTECT,
#   related_name='reordenamientos_destino')
# - cantidad_trasladada: IntegerField (validar > 0)
# - motivo: TextField blank=True
# - resolucion_numero: CharField(50) NOT NULL (CANDADO: sin resolución no hay reordenamiento)
# - estado: CharField choices:
#   PENDIENTE='pendiente', AUTORIZADO='autorizado',
#   EJECUTADO='ejecutado', CANCELADO='cancelado'
#   default='pendiente'
# - autorizado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='reordenamientos_autorizados')
# - ejecutado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='reordenamientos_ejecutados')
# - pdf_reporte_url: URLField(500) blank=True (URL del PDF generado en S3)
# - fecha_autorizacion: DateTimeField null=True
# - fecha_ejecucion: DateTimeField null=True
#
# Métodos:
# - clean(): validar que laboratorio_origen != laboratorio_destino
# - clean(): validar que cantidad_trasladada <= equipo.cantidad_disponible()
# - es_inter_sede(): retorna True si origen y destino son de diferente unidad_academica
# - __str__: "Reordenamiento #{id} - {equipo.nombre}: {origen} → {destino}"
#
# Meta: ordering = ['-created_at'], verbose_name_plural = 'Reordenamientos'

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.estructura_academica.models import BaseModel


class Reordenamiento(BaseModel):
	class Estado(models.TextChoices):
		PENDIENTE = "pendiente", "Pendiente"
		AUTORIZADO = "autorizado", "Autorizado"
		EJECUTADO = "ejecutado", "Ejecutado"
		CANCELADO = "cancelado", "Cancelado"

	equipo = models.ForeignKey(
		"laboratorios.Equipo",
		on_delete=models.PROTECT,
		related_name="reordenamientos",
	)
	laboratorio_origen = models.ForeignKey(
		"laboratorios.Laboratorio",
		on_delete=models.PROTECT,
		related_name="reordenamientos_origen",
	)
	laboratorio_destino = models.ForeignKey(
		"laboratorios.Laboratorio",
		on_delete=models.PROTECT,
		related_name="reordenamientos_destino",
	)
	cantidad_trasladada = models.IntegerField(validators=[MinValueValidator(1)])
	motivo = models.TextField(blank=True)
	resolucion_numero = models.CharField(max_length=50)
	estado = models.CharField(
		max_length=20,
		choices=Estado.choices,
		default=Estado.PENDIENTE,
	)
	autorizado_por = models.ForeignKey(
		"usuarios.Usuario",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="reordenamientos_autorizados",
	)
	ejecutado_por = models.ForeignKey(
		"usuarios.Usuario",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="reordenamientos_ejecutados",
	)
	pdf_reporte_url = models.URLField(max_length=500, blank=True)
	fecha_autorizacion = models.DateTimeField(null=True, blank=True)
	fecha_ejecucion = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ["-created_at"]
		verbose_name = "Reordenamiento"
		verbose_name_plural = "Reordenamientos"

	def __str__(self):
		return (
			f"Reordenamiento #{self.pk or 'nuevo'} - {self.equipo.nombre}: "
			f"{self.laboratorio_origen.nombre} → {self.laboratorio_destino.nombre}"
		)

	def clean(self):
		super().clean()

		if self.laboratorio_origen_id and self.laboratorio_destino_id:
			if self.laboratorio_origen_id == self.laboratorio_destino_id:
				raise ValidationError(
					{
						"laboratorio_destino": "El laboratorio de origen y destino no pueden ser iguales."
					}
				)

		if self.equipo_id and self.cantidad_trasladada:
			if self.cantidad_trasladada > self.equipo.cantidad_disponible():
				raise ValidationError(
					{
						"cantidad_trasladada": (
							"La cantidad trasladada no puede superar la cantidad disponible del equipo."
						)
					}
				)

		if self.laboratorio_origen_id and self.laboratorio_destino_id:
			if self.laboratorio_origen.unidad_academica_id is None or self.laboratorio_destino.unidad_academica_id is None:
				return

	def es_inter_sede(self):
		if not self.laboratorio_origen_id or not self.laboratorio_destino_id:
			return False
		return (
			self.laboratorio_origen.unidad_academica_id
			!= self.laboratorio_destino.unidad_academica_id
		)
