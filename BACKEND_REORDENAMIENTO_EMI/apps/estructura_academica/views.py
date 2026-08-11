from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.estructura_academica.filtros import param
from apps.estructura_academica.models import (
    Asignatura,
    Carrera,
    Departamento,
    Semestre,
    UnidadAcademica,
)
from apps.usuarios.permissions import EsAdminOJefe
from apps.estructura_academica.serializers import (
    AsignaturaListSerializer,
    CarreraSerializer,
    DepartamentoSerializer,
    SemestreSerializer,
    UnidadAcademicaSerializer,
)


class UnidadAcademicaViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """El panel de administración permite dar de alta unidades académicas.

    Sin `CreateModelMixin` el botón "Agregar Unidad Académica" existía en la UI
    pero la API respondía 405, así que el formulario nunca podía completarse.
    Crear y editar quedan restringidos a ADMIN/JEFE; la lectura, a cualquier
    usuario autenticado (la usan los filtros en cascada de todo el sistema).
    """

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update"}:
            return [EsAdminOJefe()]
        return [IsAuthenticated()]
    serializer_class = UnidadAcademicaSerializer
    queryset = UnidadAcademica.objects.filter(is_active=True).order_by("nombre")
    filter_backends = [DjangoFilterBackend]


class DepartamentoViewSet(ReadOnlyModelViewSet):
    """
    GET /api/v1/estructura_academica/departamentos/
    Filtro OPCIONAL: ?unidad_academica_id=1
    Sin filtro: devuelve TODOS los departamentos.
    Nota: el filtro usa la tabla M2M DepartamentoUnidadAcademica.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DepartamentoSerializer
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        queryset = Departamento.objects.prefetch_related("unidades_academicas").order_by("nombre")
        unidad_id = param(self.request, "unidad_academica_id")
        if unidad_id:
            queryset = queryset.filter(
                depto_sedes__unidad_academica_id=unidad_id,
                depto_sedes__is_active=True,
            ).distinct()
        return queryset


class CarreraViewSet(ReadOnlyModelViewSet):
    """
    GET /api/v1/estructura_academica/carreras/
    Filtros OPCIONALES: ?departamento_id=1 y/o ?unidad_academica_id=1
    Sin filtros: devuelve TODAS las carreras.
    Nota: el filtro por unidad_academica_id ahora busca a través de
    la tabla M2M CarreraUnidadAcademica (carreras ofertadas en esa unidad académica).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CarreraSerializer
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        queryset = (
            Carrera.objects.select_related("departamento")
            .prefetch_related("unidades_academicas")
            .order_by("nombre")
        )
        departamento_id = param(self.request, "departamento_id")
        unidad_id = param(self.request, "unidad_academica_id")
        if departamento_id:
            queryset = queryset.filter(departamento_id=departamento_id)
        if unidad_id:
            queryset = queryset.filter(
                carrera_sedes__unidad_academica_id=unidad_id,
                carrera_sedes__is_active=True,
            ).distinct()
        return queryset


class SemestreViewSet(ReadOnlyModelViewSet):
    """
    GET /api/v1/estructura_academica/semestres/
    Sin filtros obligatorios. Devuelve todos los semestres.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = SemestreSerializer
    queryset = Semestre.objects.filter(numero__gte=1, numero__lte=10).order_by("numero")
    filter_backends = [DjangoFilterBackend]


class AsignaturaViewSet(ReadOnlyModelViewSet):
    """
    GET /api/v1/estructura_academica/asignaturas/
    Filtros OPCIONALES: ?carrera_id=1 y/o ?semestre_id=5
    Sin filtros: devuelve TODAS las asignaturas activas.
    Las asignaturas son compartidas entre todas las unidades académicas (no dependen de unidad_academica).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AsignaturaListSerializer
    filter_backends = [DjangoFilterBackend]

    def get_queryset(self):
        queryset = (
            Asignatura.objects.select_related("carrera", "semestre")
            .filter(is_active=True)
            .order_by("nombre")
        )
        carrera_id = param(self.request, "carrera_id")
        semestre_id = param(self.request, "semestre_id")

        if carrera_id:
            queryset = queryset.filter(carrera_id=carrera_id)
        if semestre_id:
            queryset = queryset.filter(semestre_id=semestre_id)

        return queryset
