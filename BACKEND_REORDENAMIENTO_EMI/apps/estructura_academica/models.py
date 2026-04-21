# App: estructura_academica | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear los siguientes modelos con la jerarquía académica completa.
# Todos deben heredar de un BaseModel abstracto con created_at y updated_at.
#
# 1. Modelo 'UnidadAcademica':
#    - nombre: CharField(100)
#    - ciudad: CharField(50)
#    - codigo: CharField(10) UNIQUE (ej: 'LPZ', 'CBB', 'SCZ', 'RIB', 'TRP')
#    - is_active: BooleanField(default=True)
#
# 2. Modelo 'Departamento':
#    - nombre: CharField(100)
#    - codigo: CharField(15)
#    - unidad_academica: ForeignKey(UnidadAcademica, on_delete=PROTECT)
#    - unique_together: (codigo, unidad_academica)
#
# 3. Modelo 'Carrera':
#    - nombre: CharField(150)
#    - codigo_institucional: CharField(20) UNIQUE (código oficial del diseño curricular)
#    - departamento: ForeignKey(Departamento, on_delete=PROTECT)
#
# 4. Modelo 'CarreraUnidadAcademica' (tabla pivote M2M con datos extra):
#    - carrera: ForeignKey(Carrera, on_delete=CASCADE)
#    - unidad_academica: ForeignKey(UnidadAcademica, on_delete=CASCADE)
#    - is_active: BooleanField(default=True)
#    - unique_together: (carrera, unidad_academica)
#
# 5. Modelo 'Semestre':
#    - numero: SmallIntegerField (validators: MinValue(1), MaxValue(10))
#    - nombre: CharField(20) (ej: 'Primer Semestre')
#
# 6. Modelo 'Asignatura':
#    - nombre: CharField(150)
#    - codigo_curricular: CharField(20) UNIQUE (CLAVE: usar código oficial, no solo texto)
#    - carrera: ForeignKey(Carrera, on_delete=PROTECT)
#    - semestre: ForeignKey(Semestre, on_delete=PROTECT)
#    - unidad_academica: ForeignKey(UnidadAcademica, on_delete=PROTECT)
#    - is_active: BooleanField(default=True)
#
# Incluir __str__ descriptivos y Meta con ordering y verbose_name en español

from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class BaseModel(models.Model):
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		abstract = True


class UnidadAcademica(BaseModel):
	nombre = models.CharField(max_length=100)
	ciudad = models.CharField(max_length=50)
	codigo = models.CharField(max_length=10, unique=True)
	abreviacion = models.CharField(max_length=10, blank=True, null=True)
	is_active = models.BooleanField(default=True)

	class Meta:
		ordering = ["nombre"]
		verbose_name = "Unidad academica"
		verbose_name_plural = "Unidades academicas"

	def __str__(self):
		return f"{self.codigo} - {self.nombre}"


class Departamento(BaseModel):
	nombre = models.CharField(max_length=100)
	codigo = models.CharField(max_length=15)
	unidad_academica = models.ForeignKey(
		UnidadAcademica,
		on_delete=models.PROTECT,
		related_name="departamentos",
	)

	class Meta:
		ordering = ["nombre"]
		verbose_name = "Departamento"
		verbose_name_plural = "Departamentos"
		unique_together = (("codigo", "unidad_academica"),)

	def __str__(self):
		return f"{self.codigo} - {self.nombre} ({self.unidad_academica.codigo})"


class Carrera(BaseModel):
	nombre = models.CharField(max_length=150)
	codigo_institucional = models.CharField(max_length=20, unique=True)
	departamento = models.ForeignKey(
		Departamento,
		on_delete=models.PROTECT,
		related_name="carreras",
	)

	class Meta:
		ordering = ["nombre"]
		verbose_name = "Carrera"
		verbose_name_plural = "Carreras"

	def __str__(self):
		return f"{self.codigo_institucional} - {self.nombre}"


class CarreraUnidadAcademica(BaseModel):
	carrera = models.ForeignKey(
		Carrera,
		on_delete=models.CASCADE,
		related_name="unidades_academicas",
	)
	unidad_academica = models.ForeignKey(
		UnidadAcademica,
		on_delete=models.CASCADE,
		related_name="carreras",
	)
	is_active = models.BooleanField(default=True)

	class Meta:
		ordering = ["carrera", "unidad_academica"]
		verbose_name = "Carrera por unidad academica"
		verbose_name_plural = "Carreras por unidades academicas"
		unique_together = (("carrera", "unidad_academica"),)

	def __str__(self):
		return f"{self.carrera.nombre} - {self.unidad_academica.codigo}"


class Semestre(BaseModel):
	numero = models.SmallIntegerField(
		validators=[MinValueValidator(1), MaxValueValidator(10)]
	)
	nombre = models.CharField(max_length=20)

	class Meta:
		ordering = ["numero"]
		verbose_name = "Semestre"
		verbose_name_plural = "Semestres"

	def __str__(self):
		return f"{self.numero} - {self.nombre}"


class Asignatura(BaseModel):
	nombre = models.CharField(max_length=150)
	codigo_curricular = models.CharField(max_length=20, unique=True)
	carrera = models.ForeignKey(
		Carrera,
		on_delete=models.PROTECT,
		related_name="asignaturas",
	)
	semestre = models.ForeignKey(
		Semestre,
		on_delete=models.PROTECT,
		related_name="asignaturas",
	)
	unidad_academica = models.ForeignKey(
		UnidadAcademica,
		on_delete=models.PROTECT,
		related_name="asignaturas",
	)
	is_active = models.BooleanField(default=True)

	class Meta:
		ordering = ["nombre"]
		verbose_name = "Asignatura"
		verbose_name_plural = "Asignaturas"

	def __str__(self):
		return f"{self.codigo_curricular} - {self.nombre}"
