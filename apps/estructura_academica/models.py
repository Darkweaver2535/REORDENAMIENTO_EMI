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

# Create your models here.
