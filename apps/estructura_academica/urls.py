from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.estructura_academica.views import (
	AsignaturaViewSet,
	CarreraViewSet,
	DepartamentoViewSet,
	SemestreViewSet,
	UnidadAcademicaViewSet,
)

app_name = "estructura_academica"

router = DefaultRouter()
router.register("unidades", UnidadAcademicaViewSet, basename="unidad-academica")
router.register("departamentos", DepartamentoViewSet, basename="departamento")
router.register("carreras", CarreraViewSet, basename="carrera")
router.register("semestres", SemestreViewSet, basename="semestre")
router.register("asignaturas", AsignaturaViewSet, basename="asignatura")

urlpatterns = [
	path("", include(router.urls)),
]
