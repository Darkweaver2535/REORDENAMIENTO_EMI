# App: estructura_academica | Archivo: serializers.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear serializers para la navegación jerárquica en cascada:
#
# 1. UnidadAcademicaSerializer: campos id, nombre, ciudad, codigo
#
# 2. DepartamentoSerializer: campos id, nombre, codigo, unidad_academica_id,
#    unidad_academica_nombre (SerializerMethodField)
#
# 3. CarreraSerializer: campos id, nombre, codigo_institucional, departamento_id
#
# 4. SemestreSerializer: campos id, numero, nombre
#
# 5. AsignaturaSerializer: campos id, nombre, codigo_curricular, carrera_id,
#    carrera_nombre, semestre_id, semestre_numero, unidad_academica_id
#
# 6. AsignaturaDetalleSerializer (extiende AsignaturaSerializer):
#    Agrega campos anidados completos de carrera y semestre
#    Se usa cuando se necesita el detalle completo (no en listas)

from rest_framework import serializers

from apps.estructura_academica.models import (
	Asignatura,
	Carrera,
	Departamento,
	Semestre,
	UnidadAcademica,
)


class UnidadAcademicaSerializer(serializers.ModelSerializer):
	class Meta:
		model = UnidadAcademica
		fields = ("id", "nombre", "ciudad", "codigo")


class DepartamentoSerializer(serializers.ModelSerializer):
	unidad_academica_nombre = serializers.SerializerMethodField()

	class Meta:
		model = Departamento
		fields = (
			"id",
			"nombre",
			"codigo",
			"unidad_academica_id",
			"unidad_academica_nombre",
		)

	def get_unidad_academica_nombre(self, obj):
		if obj.unidad_academica_id is None:
			return None
		return obj.unidad_academica.nombre


class CarreraSerializer(serializers.ModelSerializer):
	class Meta:
		model = Carrera
		fields = ("id", "nombre", "codigo_institucional", "departamento_id")


class SemestreSerializer(serializers.ModelSerializer):
	class Meta:
		model = Semestre
		fields = ("id", "numero", "nombre")


class AsignaturaSerializer(serializers.ModelSerializer):
	carrera_nombre = serializers.CharField(source="carrera.nombre", read_only=True)
	semestre_numero = serializers.IntegerField(source="semestre.numero", read_only=True)

	class Meta:
		model = Asignatura
		fields = (
			"id",
			"nombre",
			"codigo_curricular",
			"carrera_id",
			"carrera_nombre",
			"semestre_id",
			"semestre_numero",
			"unidad_academica_id",
		)


class AsignaturaDetalleSerializer(AsignaturaSerializer):
	carrera = CarreraSerializer(read_only=True)
	semestre = SemestreSerializer(read_only=True)

	class Meta(AsignaturaSerializer.Meta):
		fields = AsignaturaSerializer.Meta.fields + (
			"carrera",
			"semestre",
		)
