# App: guias | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear el modelo 'Guia' para gestionar prácticas de laboratorio.
# Debe heredar del BaseModel abstracto (created_at, updated_at).
#
# Campos del modelo 'Guia':
# - titulo: CharField(200)
# - codigo_interno: CharField(30) UNIQUE
# - numero_practica: SmallIntegerField (número dentro de la asignatura, ej: 1, 2, 3...)
# - asignatura: ForeignKey('estructura_academica.Asignatura', on_delete=PROTECT)
# - portada_url: URLField(max_length=500) - URL de la imagen JPG/PNG en S3
#   (blank=True, se puede generar automáticamente del PDF)
# - pdf_url: URLField(max_length=500) - URL del PDF en S3 (NOT NULL)
# - estado: CharField con choices:
#   BORRADOR='borrador', PENDIENTE='pendiente', APROBADO='aprobado', PUBLICADO='publicado'
#   default='borrador'
# - resolucion_numero: CharField(50) null=True blank=True
#   (REQUERIDO para poder publicar - es el candado institucional)
# - aprobado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='guias_aprobadas')
# - motivo_rechazo: TextField blank=True (para cuando la autoridad rechaza)
# - unique_together: (asignatura, numero_practica) - no puede haber dos práctica 3 en la misma materia
#
# Métodos del modelo:
# - puede_publicarse(): retorna True si resolucion_numero is not None and estado == 'aprobado'
# - es_visible_para_estudiantes(): retorna True si estado == 'publicado'
# - __str__: retorna "Práctica {numero} - {asignatura.nombre}"
#
# Meta: ordering = ['asignatura', 'numero_practica'], verbose_name_plural = 'Guías'

from django.db import models

from apps.estructura_academica.models import BaseModel


class Guia(BaseModel):
	class Estado(models.TextChoices):
		BORRADOR = "borrador", "Borrador"
		PENDIENTE = "pendiente", "Pendiente"
		APROBADO = "aprobado", "Aprobado"
		PUBLICADO = "publicado", "Publicado"

	titulo = models.CharField(max_length=200)
	codigo_interno = models.CharField(max_length=30, unique=True)
	numero_practica = models.SmallIntegerField()
	asignatura = models.ForeignKey(
		"estructura_academica.Asignatura",
		on_delete=models.PROTECT,
		related_name="guias",
	)
	portada_url = models.URLField(max_length=500, blank=True)
	pdf_url = models.URLField(max_length=500)
	estado = models.CharField(
		max_length=20,
		choices=Estado.choices,
		default=Estado.BORRADOR,
	)
	resolucion_numero = models.CharField(max_length=50, null=True, blank=True)
	aprobado_por = models.ForeignKey(
		"usuarios.Usuario",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="guias_aprobadas",
	)
	motivo_rechazo = models.TextField(blank=True)

	class Meta:
		ordering = ["asignatura", "numero_practica"]
		verbose_name = "Guia"
		verbose_name_plural = "Guias"
		unique_together = (("asignatura", "numero_practica"),)

	def save(self, *args, **kwargs):
		if self.estado:
			self.estado = self.estado.lower().strip()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"Práctica {self.numero_practica} - {self.asignatura.nombre}"

	def puede_publicarse(self):
		return self.resolucion_numero is not None and self.estado == self.Estado.APROBADO

	def es_visible_para_estudiantes(self):
		return self.estado == self.Estado.PUBLICADO
