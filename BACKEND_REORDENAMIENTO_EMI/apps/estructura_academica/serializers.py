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
		fields = ("id", "nombre", "ciudad", "codigo", "abreviacion")


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


class AsignaturaListSerializer(serializers.ModelSerializer):
	carrera_nombre = serializers.SerializerMethodField()
	semestre_numero = serializers.SerializerMethodField()

	class Meta:
		model = Asignatura
		fields = (
			"id",
			"nombre",
			"codigo_curricular",
			"carrera_id",
			"semestre_id",
			"unidad_academica_id",
			"carrera_nombre",
			"semestre_numero",
		)

	def get_carrera_nombre(self, instance):
		if instance.carrera_id is None:
			return None
		return instance.carrera.nombre

	def get_semestre_numero(self, instance):
		if instance.semestre_id is None:
			return None
		return instance.semestre.numero


class AsignaturaDetalleSerializer(AsignaturaListSerializer):
	carrera = CarreraSerializer(read_only=True)
	semestre = SemestreSerializer(read_only=True)
	unidad_academica = UnidadAcademicaSerializer(read_only=True)

	class Meta(AsignaturaListSerializer.Meta):
		fields = AsignaturaListSerializer.Meta.fields + (
			"carrera",
			"semestre",
			"unidad_academica",
		)
