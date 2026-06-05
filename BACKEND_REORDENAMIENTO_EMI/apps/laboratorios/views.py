from django.core.cache import cache
from django.utils import timezone
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.laboratorios.models import Equipo, Laboratorio
from apps.laboratorios.serializers import (
    EquipoDetalleSerializer,
    EquipoListSerializer,
    EvaluacionInsituSerializer,
    LaboratorioDetalleSerializer,
    LaboratorioListSerializer,
    LaboratorioTreeSerializer,
)
from apps.laboratorios.services import InventoryAnalyticsService
from apps.laboratorios.storage import ErrorImagen, subir_imagen_equipo
from apps.usuarios.models import AuditLog
from apps.usuarios.permissions import (
    EsAdminOJefe,
    EsEncargadoActivos,
    scope_inventario_por_rol,
)


class LaboratorioPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 1000


class LaboratorioViewSet(ModelViewSet):
    """ViewSet para gestión de laboratorios con analytics cacheados."""

    queryset = Laboratorio.objects.none()
    pagination_class = LaboratorioPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "sala", "unidad_academica__nombre"]
    ordering_fields = ["nombre", "created_at"]

    def get_queryset(self):
        queryset = Laboratorio.objects.select_related("unidad_academica")

        unidad_id = self.request.query_params.get("unidad_id")
        if unidad_id:
            queryset = queryset.filter(unidad_academica_id=unidad_id)

        # Regla de negocio: laboratorios operativos son los nodos hoja (sin hijos),
        # independientemente de si son raíz (parent=None) o hijos (parent!=None).
        operativos_solo = self.request.query_params.get("operativos_solo")
        if operativos_solo and operativos_solo.lower() == "true":
            queryset = queryset.filter(hijos__isnull=True).distinct()

        # FIX #15: ADMIN/JEFE ven todo; ENCARGADO_ACTIVOS solo su sede; el resto nada.
        queryset = scope_inventario_por_rol(queryset, self.request.user)

        return queryset

    def paginate_queryset(self, queryset):
        # Deshabilitar paginación si estamos solicitando operativos (para los dropdowns del frontend)
        if self.request.query_params.get("operativos_solo", "").lower() == "true":
            return None
        return super().paginate_queryset(queryset)

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [IsAuthenticated]
        elif self.action in {"create", "update", "partial_update", "destroy"}:
            permission_classes = [EsAdminOJefe]
        elif self.action in {"analytics"}:
            permission_classes = [EsAdminOJefe]
        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == "list":
            return LaboratorioListSerializer
        if self.action == "retrieve":
            return LaboratorioDetalleSerializer
        if self.action in {"create", "update", "partial_update"}:
            return LaboratorioListSerializer
        return LaboratorioDetalleSerializer

    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """Devuelve el árbol completo de laboratorios (solo raíces con hijos anidados).

        Cada nodo raíz (parent=None) incluye recursivamente su lista de hijos.
        Los prefetch de 4 niveles cubren jerarquías de hasta General→Sección→Área→Lab.
        """
        raices = (
            Laboratorio.objects.filter(parent=None)
            .prefetch_related("hijos__hijos__hijos__hijos")
            .select_related("unidad_academica")
        )
        # FIX #15: el árbol también respeta la visibilidad por rol/sede.
        raices = scope_inventario_por_rol(raices, request.user)
        serializer = LaboratorioTreeSerializer(raices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request, pk=None):
        """Obtiene analítica del laboratorio.

        FIX #19: antes esta action duplicaba la lógica (y el cacheo) de
        InventoryAnalyticsService.calcular(). Ahora delega en el service, que ya
        gestiona el caché Redis y, además, calcula el uso de equipos por lote (#13).
        """
        laboratorio = self.get_object()
        data = InventoryAnalyticsService.calcular(laboratorio.id)
        return Response(data, status=status.HTTP_200_OK)


class EquipoViewSet(ModelViewSet):
    """ViewSet para gestión de equipos con evaluación in-situ."""

    queryset = Equipo.objects.none()
    pagination_class = LaboratorioPagination

    def get_queryset(self):
        queryset = Equipo.objects.select_related(
            "unidad_academica", "laboratorio", "laboratorio__unidad_academica", "evaluado_por"
        )

        modo = self.request.query_params.get("modo")
        if modo == "compra":
            # Para modo COMPRA (recepción/ingreso), listamos estrictamente los equipos
            # que aún no han sido asignados a ningún laboratorio (laboratorio es NULL).
            # Esto evita que se "compre" (recepcione) un equipo que ya está operativo.
            queryset = queryset.filter(laboratorio__isnull=True)
            # FIX #15: aplica visibilidad por rol/sede también en modo compra
            # (todos los equipos tienen unidad_academica, incluso sin laboratorio).
            return scope_inventario_por_rol(queryset, self.request.user)

        laboratorio_id = self.request.query_params.get("laboratorio_id")
        if laboratorio_id:
            queryset = queryset.filter(laboratorio_id=laboratorio_id)

        # FIX #15: ADMIN/JEFE ven todo; ENCARGADO_ACTIVOS solo su sede; el resto nada.
        queryset = scope_inventario_por_rol(queryset, self.request.user)

        return queryset

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            permission_classes = [IsAuthenticated]
        elif self.action in {
            "create",
            "update",
            "partial_update",
            "destroy",
            "evaluacion_insitu",
            "subir_foto",
        }:
            permission_classes = [EsEncargadoActivos]
        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == "list":
            return EquipoListSerializer
        if self.action == "retrieve":
            return EquipoDetalleSerializer
        if self.action in {"create", "update", "partial_update", "evaluacion_insitu"}:
            return EquipoDetalleSerializer
        return EquipoDetalleSerializer

    @action(detail=True, methods=["patch"], url_path="evaluacion-insitu")
    def evaluacion_insitu(self, request, pk=None):
        """Registra evaluación in-situ de equipo (cantidad buena/regular/mala)."""
        equipo = self.get_object()

        serializer = EvaluacionInsituSerializer(data=request.data, context={"equipo": equipo})
        serializer.is_valid(raise_exception=True)

        # Capturar estado anterior completo
        datos_anteriores = EquipoDetalleSerializer(equipo).data

        # Actualizar cantidades y observaciones
        equipo.cantidad_buena = serializer.validated_data["cantidad_buena"]
        equipo.cantidad_regular = serializer.validated_data["cantidad_regular"]
        equipo.cantidad_mala = serializer.validated_data["cantidad_mala"]
        equipo.cantidad_total = serializer.validated_data["cantidad_total"]
        equipo.estatus_general = serializer.validated_data["condicion"]
        equipo.observaciones = serializer.validated_data.get("observaciones", equipo.observaciones)
        equipo.evaluado_en = timezone.now()
        equipo.evaluado_por = request.user
        equipo.save()

        # Invalidar caché de analytics del laboratorio
        cache.delete(f"analytics:{equipo.laboratorio_id}")

        # Registrar en AuditLog
        datos_nuevos = EquipoDetalleSerializer(equipo).data
        AuditLog.objects.create(
            tabla_afectada="Equipo",
            registro_id=equipo.id,
            accion=AuditLog.Accion.UPDATE,
            usuario=request.user,
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
        )

        return Response(EquipoDetalleSerializer(equipo).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="subir-foto",
        parser_classes=[MultiPartParser, FormParser],
    )
    def subir_foto(self, request, pk=None):
        """Sube la foto del equipo a S3 (o media local) y actualiza foto_url (#11).

        Completa la intención que quedó a medias: en vez de pegar una URL a mano,
        el cliente envía el archivo (campo 'foto') y el backend lo almacena y
        guarda la URL resultante.
        """
        equipo = self.get_object()
        archivo = request.FILES.get("foto")
        if not archivo:
            return Response(
                {"foto": "Debe enviar el archivo de imagen en el campo 'foto'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            base_url = request.build_absolute_uri("/")[:-1]
            url = subir_imagen_equipo(archivo, equipo.id, base_url=base_url)
        except ErrorImagen as exc:
            return Response({"foto": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        equipo.foto_url = url
        equipo.save(update_fields=["foto_url"])

        AuditLog.objects.create(
            tabla_afectada="Equipo",
            registro_id=equipo.id,
            accion=AuditLog.Accion.UPDATE,
            usuario=request.user,
            datos_nuevos={"evento": "foto_actualizada", "foto_url": url},
        )

        return Response({"foto_url": url}, status=status.HTTP_200_OK)
