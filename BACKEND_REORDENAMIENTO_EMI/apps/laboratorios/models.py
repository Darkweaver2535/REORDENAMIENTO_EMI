# App: laboratorios | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear tres modelos para gestionar laboratorios físicos y equipos (activos).
# Todos heredan de BaseModel (created_at, updated_at).
#
# 1. Modelo 'Laboratorio':
#    - nombre: CharField(150) (ej: "Laboratorio de Química")
#    - unidad_academica: ForeignKey('estructura_academica.UnidadAcademica', on_delete=PROTECT)
#    - campus: CharField(100)
#    - edificio: CharField(50) blank=True
#    - piso: SmallIntegerField null=True
#    - sala: CharField(50) (sala específica, ej: "Sala 203-B")
#    - capacidad_estudiantes: IntegerField default=0
#    - is_active: BooleanField(default=True)
#    - asignaturas: ManyToManyField('estructura_academica.Asignatura',
#      through='LaboratorioAsignatura', related_name='laboratorios')
#
# 2. Modelo 'LaboratorioAsignatura' (tabla M2M con datos extra):
#    - laboratorio: ForeignKey(Laboratorio, on_delete=CASCADE)
#    - asignatura: ForeignKey('estructura_academica.Asignatura', on_delete=CASCADE)
#    - unique_together: (laboratorio, asignatura)
#
# 3. Modelo 'Equipo' (activo físico):
#    - nombre: CharField(150)
#    - codigo_activo: CharField(50) UNIQUE (código del sistema de activos universitario)
#    - laboratorio: ForeignKey(Laboratorio, on_delete=PROTECT, related_name='equipos')
#    - cantidad_total: IntegerField(default=0)
#    - cantidad_buena: IntegerField(default=0)
#    - cantidad_regular: IntegerField(default=0)
#    - cantidad_mala: IntegerField(default=0)
#    - estatus_general: CharField choices: BUENO='bueno', REGULAR='regular', MALO='malo'
#    - ubicacion_sala: CharField(100) blank=True (ubicación exacta dentro del laboratorio)
#    - observaciones: TextField blank=True (ej: "le falta la tapa", "guardado en caja 3")
#    - evaluado_en: DateTimeField null=True (cuándo se hizo la última evaluación in-situ)
#    - evaluado_por: ForeignKey('usuarios.Usuario', null=True, blank=True, on_delete=SET_NULL)
#
#    Métodos del modelo Equipo:
#    - cantidad_disponible(): retorna cantidad_buena + cantidad_regular
#      (REGLA: los malos NO cuentan para atender prácticas)
#    - clean(): validar que buena + regular + mala == total (consistencia)
#    - __str__: retorna "{codigo_activo} - {nombre} ({laboratorio.nombre})"
#
# 4. Modelo 'EquipoRequeridoPorGuia' (TABLA PIVOTE CRÍTICA - cruce teórico vs real):
#    - guia: ForeignKey('guias.Guia', on_delete=CASCADE, related_name='equipos_requeridos')
#    - nombre_equipo_teorico: CharField(150)
#      (nombre como aparece en el PDF de la guía, ej: "Manómetro en U")
#    - equipo: ForeignKey(Equipo, null=True, blank=True, on_delete=SET_NULL,
#      related_name='guias_que_requieren')
#      (NULL si aún no se vinculó al activo físico real)
#    - cantidad_requerida: IntegerField(default=1)
#    - notas: TextField blank=True
#
#    Métodos de EquipoRequeridoPorGuia:
#    - tiene_deficit(): retorna True si equipo is not None y
#      equipo.cantidad_disponible() < cantidad_requerida
#    - cantidad_deficit(): retorna max(0, cantidad_requerida - equipo.cantidad_disponible())
#      si equipo is not None, else retorna cantidad_requerida
#
# Incluir Meta con verbose_names en español y ordering apropiado para cada modelo

from django.core.exceptions import ValidationError
from django.db import models

from apps.estructura_academica.models import BaseModel


class Laboratorio(BaseModel):
	nombre = models.CharField(max_length=150)
	unidad_academica = models.ForeignKey(
		"estructura_academica.UnidadAcademica",
		on_delete=models.PROTECT,
		related_name="laboratorios",
	)
	campus = models.CharField(max_length=100)
	edificio = models.CharField(max_length=50, blank=True)
	piso = models.SmallIntegerField(null=True, blank=True)
	sala = models.CharField(max_length=50)
	capacidad_estudiantes = models.IntegerField(default=0)
	is_active = models.BooleanField(default=True)
	asignaturas = models.ManyToManyField(
		"estructura_academica.Asignatura",
		through="LaboratorioAsignatura",
		related_name="laboratorios",
	)

	class Meta:
		ordering = ["nombre"]
		verbose_name = "Laboratorio"
		verbose_name_plural = "Laboratorios"

	def __str__(self):
		return f"{self.nombre} ({self.sala})"


class LaboratorioAsignatura(BaseModel):
	laboratorio = models.ForeignKey(
		Laboratorio,
		on_delete=models.CASCADE,
		related_name="laboratorio_asignaturas",
	)
	asignatura = models.ForeignKey(
		"estructura_academica.Asignatura",
		on_delete=models.CASCADE,
		related_name="asignatura_laboratorios",
	)

	class Meta:
		ordering = ["laboratorio", "asignatura"]
		verbose_name = "Laboratorio y asignatura"
		verbose_name_plural = "Laboratorios y asignaturas"
		unique_together = (("laboratorio", "asignatura"),)

	def __str__(self):
		return f"{self.laboratorio.nombre} - {self.asignatura.nombre}"


class Equipo(BaseModel):
	class EstatusGeneral(models.TextChoices):
		BUENO = "bueno", "Bueno"
		REGULAR = "regular", "Regular"
		MALO = "malo", "Malo"

	nombre = models.CharField(max_length=150)
	codigo_activo = models.CharField(max_length=50, unique=True)
	laboratorio = models.ForeignKey(
		Laboratorio,
		on_delete=models.PROTECT,
		related_name="equipos",
	)
	cantidad_total = models.IntegerField(default=0)
	cantidad_buena = models.IntegerField(default=0)
	cantidad_regular = models.IntegerField(default=0)
	cantidad_mala = models.IntegerField(default=0)
	estatus_general = models.CharField(
		max_length=20,
		choices=EstatusGeneral.choices,
		default=EstatusGeneral.BUENO,
	)
	ubicacion_sala = models.CharField(max_length=100, blank=True)
	observaciones = models.TextField(blank=True)
	evaluado_en = models.DateTimeField(null=True, blank=True)
	evaluado_por = models.ForeignKey(
		"usuarios.Usuario",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="equipos_evaluados",
	)

	class Meta:
		ordering = ["codigo_activo"]
		verbose_name = "Equipo"
		verbose_name_plural = "Equipos"

	def __str__(self):
		return f"{self.codigo_activo} - {self.nombre} ({self.laboratorio.nombre})"

	def cantidad_disponible(self):
		return self.cantidad_buena + self.cantidad_regular

	def clean(self):
		super().clean()
		total_calculado = self.cantidad_buena + self.cantidad_regular + self.cantidad_mala
		if self.cantidad_total != total_calculado:
			raise ValidationError(
				{
					"cantidad_total": (
						"La suma de cantidad_buena, cantidad_regular y cantidad_mala debe ser igual a cantidad_total."
					)
				}
			)


class EquipoRequeridoPorGuia(BaseModel):
	guia = models.ForeignKey(
		"guias.Guia",
		on_delete=models.CASCADE,
		related_name="equipos_requeridos",
	)
	nombre_equipo_teorico = models.CharField(max_length=150)
	equipo = models.ForeignKey(
		Equipo,
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="guias_que_requieren",
	)
	cantidad_requerida = models.IntegerField(default=1)
	notas = models.TextField(blank=True)

	class Meta:
		ordering = ["guia", "nombre_equipo_teorico"]
		verbose_name = "Equipo requerido por guia"
		verbose_name_plural = "Equipos requeridos por guia"

	def __str__(self):
		return f"{self.guia} - {self.nombre_equipo_teorico}"

	def tiene_deficit(self):
		return self.equipo is not None and self.equipo.cantidad_disponible() < self.cantidad_requerida

	def cantidad_deficit(self):
		if self.equipo is None:
			return self.cantidad_requerida
		return max(0, self.cantidad_requerida - self.equipo.cantidad_disponible())
