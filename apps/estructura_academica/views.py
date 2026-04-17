from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.estructura_academica.models import Asignatura, Carrera, Departamento, Semestre, UnidadAcademica
from apps.estructura_academica.serializers import (
	AsignaturaListSerializer,
	CarreraSerializer,
	DepartamentoSerializer,
	SemestreSerializer,
	UnidadAcademicaSerializer,
)


class _QueryParamValidationMixin:
	required_query_params = ()

	def list(self, request, *args, **kwargs):
		missing = [param for param in self.required_query_params if not request.query_params.get(param)]
		if missing:
			return Response(
				{
					"detail": (
						f"Parámetros requeridos faltantes: {', '.join(missing)}"
					)
				},
				status=status.HTTP_400_BAD_REQUEST,
			)
		return super().list(request, *args, **kwargs)


class UnidadAcademicaViewSet(ReadOnlyModelViewSet):
	permission_classes = [IsAuthenticated]
	serializer_class = UnidadAcademicaSerializer
	queryset = UnidadAcademica.objects.filter(is_active=True).order_by("nombre")
	filter_backends = [DjangoFilterBackend]


class DepartamentoViewSet(_QueryParamValidationMixin, ReadOnlyModelViewSet):
	permission_classes = [IsAuthenticated]
	serializer_class = DepartamentoSerializer
	filter_backends = [DjangoFilterBackend]
	filterset_fields = ["unidad_academica_id"]
	required_query_params = ("unidad_id",)

	def get_queryset(self):
		unidad_id = self.request.query_params.get("unidad_id")
		return (
			Departamento.objects.select_related("unidad_academica")
			.filter(unidad_academica_id=unidad_id)
			.order_by("nombre")
		)


class CarreraViewSet(_QueryParamValidationMixin, ReadOnlyModelViewSet):
	permission_classes = [IsAuthenticated]
	serializer_class = CarreraSerializer
	filter_backends = [DjangoFilterBackend]
	filterset_fields = ["departamento_id"]
	required_query_params = ("dept_id",)

	def get_queryset(self):
		dept_id = self.request.query_params.get("dept_id")
		return (
			Carrera.objects.select_related("departamento")
			.filter(departamento_id=dept_id)
			.order_by("nombre")
		)


class SemestreViewSet(ReadOnlyModelViewSet):
	permission_classes = [IsAuthenticated]
	serializer_class = SemestreSerializer
	queryset = Semestre.objects.filter(numero__gte=1, numero__lte=10).order_by("numero")
	filter_backends = [DjangoFilterBackend]


class AsignaturaViewSet(_QueryParamValidationMixin, ReadOnlyModelViewSet):
	permission_classes = [IsAuthenticated]
	serializer_class = AsignaturaListSerializer
	filter_backends = [DjangoFilterBackend]
	filterset_fields = ["carrera_id", "semestre_id", "unidad_academica_id"]
	required_query_params = ("carrera_id", "semestre_id", "unidad_id")

	def get_queryset(self):
		carrera_id = self.request.query_params.get("carrera_id")
		semestre_id = self.request.query_params.get("semestre_id")
		unidad_id = self.request.query_params.get("unidad_id")

		return (
			Asignatura.objects.select_related("carrera", "semestre", "unidad_academica")
			.filter(
				carrera_id=carrera_id,
				semestre_id=semestre_id,
				unidad_academica_id=unidad_id,
				is_active=True,
			)
			.order_by("nombre")
		)
