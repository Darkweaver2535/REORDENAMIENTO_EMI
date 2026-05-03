from django.db import models
from django.utils import timezone


class RegistroMantenimiento(models.Model):
	"""Bitácora de mantenimiento, calibración y reparación de equipos."""

	class Tipo(models.TextChoices):
		PREVENTIVO   = "preventivo",   "Mantenimiento Preventivo"
		CORRECTIVO   = "correctivo",   "Mantenimiento Correctivo"
		LIMPIEZA     = "limpieza",     "Limpieza y Desinfección"
		REPARACION   = "reparacion",   "Reparación"
		CALIBRACION  = "calibracion",  "Calibración"
		VERIFICACION = "verificacion", "Verificación Técnica"

	class Estado(models.TextChoices):
		REALIZADO  = "realizado",  "Realizado"
		PENDIENTE  = "pendiente",  "Pendiente"
		EN_PROCESO = "en_proceso", "En Proceso"
		CANCELADO  = "cancelado",  "Cancelado"

	equipo = models.ForeignKey(
		"laboratorios.Equipo",
		on_delete=models.CASCADE,
		related_name="mantenimientos",
	)
	realizado_por = models.ForeignKey(
		"usuarios.Usuario",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="mantenimientos_realizados",
		verbose_name="Responsable",
	)

	tipo = models.CharField(max_length=20, choices=Tipo.choices)
	estado = models.CharField(
		max_length=20,
		choices=Estado.choices,
		default=Estado.REALIZADO,
	)
	descripcion = models.TextField(verbose_name="Descripción del trabajo")
	observaciones = models.TextField(blank=True, null=True)

	fecha_realizacion = models.DateField(verbose_name="Fecha de realización")
	fecha_proximo = models.DateField(
		null=True,
		blank=True,
		verbose_name="Fecha del próximo servicio",
	)

	# Solo calibraciones / verificaciones
	numero_certificado = models.CharField(
		max_length=100,
		blank=True,
		null=True,
		verbose_name="N° Certificado",
	)
	entidad_calibradora = models.CharField(
		max_length=200,
		blank=True,
		null=True,
		verbose_name="Entidad calibradora",
	)

	fecha_registro = models.DateTimeField(auto_now_add=True)

	class Meta:
		verbose_name = "Registro de Mantenimiento"
		verbose_name_plural = "Bitácora de Mantenimientos"
		ordering = ["-fecha_realizacion"]

	def save(self, *args, **kwargs):
		if self.tipo:
			self.tipo = self.tipo.lower().strip()
		if self.estado:
			self.estado = self.estado.lower().strip()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"{self.get_tipo_display()} — {self.equipo} — {self.fecha_realizacion}"

	@property
	def es_calibracion(self):
		return self.tipo in ("calibracion", "verificacion")

	@property
	def dias_para_proximo(self):
		if not self.fecha_proximo:
			return None
		delta = self.fecha_proximo - timezone.now().date()
		return delta.days
