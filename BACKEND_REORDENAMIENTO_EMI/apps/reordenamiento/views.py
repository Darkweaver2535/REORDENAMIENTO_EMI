from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.reordenamiento.serializers import (
    ReordenamientoListSerializer,
    ReordenamientoDetalleSerializer,
    CrearReordenamientoSerializer,
    AprobarReordenamientoSerializer,
    AutorizarReordenamientoSerializer,
    RecepcinarReordenamientoSerializer,
)
from apps.reordenamiento.services import ReordenamientoService
from apps.usuarios.permissions import EsAdminOJefe, EsEncargadoActivos, EsDNCIT


class ReordenamientoViewSet(ModelViewSet):
    """ViewSet para el flujo completo de movimientos de equipos entre laboratorios.

    Endpoints principales:
      POST   /                  — Crear nuevo movimiento (multipart/form-data si hay archivo)
      GET    /                  — Listar con filtros (tipo_movimiento, estado)
      GET    /{id}/             — Detalle
      POST   /{id}/aprobar/     — Aprueba (DNCIT / admin|jefe)
      POST   /{id}/autorizar/   — Alias legacy de aprobar
      POST   /{id}/ejecutar/    — Marca EN_TRANSITO
      POST   /{id}/recepcionar/ — Confirma recepción (estado final: RECEPCIONADO)
      GET    /comparativa-sedes/ — Análisis por nombre de equipo
    """

    queryset = Reordenamiento.objects.none()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Reordenamiento.objects.select_related(
            "equipo",
            "laboratorio_origen",
            "laboratorio_destino",
            "aprobado_por",
            "autorizado_por",
            "ejecutado_por",
            "recepcionado_por",
        )

        params = self.request.query_params

        if lab_origen := params.get("laboratorio_origen_id"):
            qs = qs.filter(laboratorio_origen_id=lab_origen)

        if lab_destino := params.get("laboratorio_destino_id"):
            qs = qs.filter(laboratorio_destino_id=lab_destino)

        if estado := params.get("estado"):
            qs = qs.filter(estado=estado)

        if tipo := params.get("tipo_movimiento"):
            qs = qs.filter(tipo_movimiento=tipo)

        # Restricción por rol: encargado_activos solo ve movimientos de su unidad.
        # FIX #6: el modelo Usuario NO tiene relación `laboratorio`; su sede es
        # `unidad_academica` (FK directo). El código anterior usaba user.laboratorio,
        # que nunca existe → hasattr() era False y el encargado caía siempre en
        # qs.none(), sin ver ningún reordenamiento.
        user = self.request.user
        if hasattr(user, "rol") and (user.rol or "").strip().lower() == "encargado_activos":
            unidad_id = getattr(user, "unidad_academica_id", None)
            if unidad_id:
                qs = qs.filter(
                    Q(laboratorio_origen__unidad_academica_id=unidad_id)
                    | Q(laboratorio_destino__unidad_academica_id=unidad_id)
                )
            else:
                # Encargado sin unidad académica asignada: no puede determinar su
                # ámbito, así que no ve movimientos hasta que se le asigne una sede.
                qs = qs.none()

        return qs

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            perm = [IsAuthenticated]
        elif self.action in {"create", "update", "partial_update", "destroy"}:
            perm = [EsAdminOJefe]
        elif self.action in {"aprobar", "autorizar"}:
            perm = [EsDNCIT]
        elif self.action == "ejecutar":
            perm = [EsEncargadoActivos]
        elif self.action == "recepcionar":
            perm = [IsAuthenticated]
        elif self.action == "comparativa_sedes":
            perm = [EsAdminOJefe]
        else:
            perm = [IsAuthenticated]
        return [p() for p in perm]

    def get_serializer_class(self):
        if self.action == "list":
            return ReordenamientoListSerializer
        if self.action == "retrieve":
            return ReordenamientoDetalleSerializer
        if self.action in {"create", "update", "partial_update"}:
            return CrearReordenamientoSerializer
        if self.action == "aprobar":
            return AprobarReordenamientoSerializer
        if self.action == "autorizar":
            return AutorizarReordenamientoSerializer
        if self.action == "recepcionar":
            return RecepcinarReordenamientoSerializer
        return ReordenamientoDetalleSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        reordenamiento = ReordenamientoService.crear_movimiento(
            tipo_movimiento=data["tipo_movimiento"],
            equipo_id=data["equipo_id"],
            lab_origen_id=data.get("laboratorio_origen_id"),
            lab_destino_id=data["laboratorio_destino_id"],
            cantidad=data["cantidad_trasladada"],
            motivo=data.get("motivo", ""),
            numero_documento=data.get("numero_documento", ""),
            tipo_documento=data.get("tipo_documento"),
            documento_respaldo=data.get("documento_respaldo"),
            fecha_retorno_prevista=data.get("fecha_retorno_prevista"),
            usuario_solicitante=request.user,
        )
        
        detalle_serializer = ReordenamientoDetalleSerializer(reordenamiento, context=self.get_serializer_context())
        headers = self.get_success_headers(detalle_serializer.data)
        return Response(detalle_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    # ── Acción: aprobar ─────────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="aprobar")
    def aprobar(self, request, pk=None):
        """Aprueba el movimiento. Sólo usuarios autorizados (DNCIT / admin|jefe)."""
        reord = self.get_object()
        serializer = AprobarReordenamientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        estados_aprobables = {
            Reordenamiento.Estado.PENDIENTE_APROBACION,
            Reordenamiento.Estado.PENDIENTE,  # legacy
        }
        if reord.estado not in estados_aprobables:
            return Response(
                {"detail": "El reordenamiento no está en estado aprobable.", "estado_actual": reord.estado},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ReordenamientoService.aprobar(reord.id, request.user)
        return Response(
            {"estado": Reordenamiento.Estado.APROBADO, "mensaje": "Reordenamiento aprobado."},
            status=status.HTTP_200_OK,
        )

    # ── Acción: autorizar (legacy, no alias 302) ────────────────────────────
    @action(detail=True, methods=["post"], url_path="autorizar")
    def autorizar(self, request, pk=None):
        """Acción legacy para compatibilidad con clientes anteriores.

        Internamente invoca la misma lógica que 'aprobar'.
        No se usa un redirect HTTP; se conserva como endpoint real.
        """
        reord = self.get_object()
        serializer = AutorizarReordenamientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        estados_aprobables = {
            Reordenamiento.Estado.PENDIENTE_APROBACION,
            Reordenamiento.Estado.PENDIENTE,
        }
        if reord.estado not in estados_aprobables:
            return Response(
                {"detail": "El reordenamiento debe estar pendiente para autorizar.", "estado_actual": reord.estado},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ReordenamientoService.aprobar(reord.id, request.user)
        return Response(
            {"estado": Reordenamiento.Estado.APROBADO, "mensaje": "Reordenamiento autorizado (aprobado)."},
            status=status.HTTP_200_OK,
        )

    # ── Acción: ejecutar (marca EN_TRANSITO) ────────────────────────────────
    @action(detail=True, methods=["post"], url_path="ejecutar")
    def ejecutar(self, request, pk=None):
        """Marca el reordenamiento como EN_TRANSITO (equipo físicamente en camino)."""
        reord = self.get_object()

        estados_validos = {Reordenamiento.Estado.APROBADO, Reordenamiento.Estado.AUTORIZADO}
        if reord.estado not in estados_validos:
            return Response(
                {"detail": "El reordenamiento debe estar Aprobado para ejecutar.", "estado_actual": reord.estado},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ReordenamientoService.marcar_en_transito(reord.id, request.user)
        return Response(
            {"estado": Reordenamiento.Estado.EN_TRANSITO, "mensaje": "Reordenamiento marcado como En tránsito."},
            status=status.HTTP_200_OK,
        )

    # ── Acción: recepcionar ─────────────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="recepcionar")
    def recepcionar(self, request, pk=None):
        """Confirma recepción física. Estado final: RECEPCIONADO.

        Mueve el equipo al laboratorio destino (solo para REASIGNACION_DEFINITIVA).
        Notifica a Activos Fijos.
        """
        reord = self.get_object()
        serializer = RecepcinarReordenamientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        estados_recepcionables = {
            Reordenamiento.Estado.EN_TRANSITO,
            Reordenamiento.Estado.APROBADO,
            Reordenamiento.Estado.EJECUTADO,  # legacy
            Reordenamiento.Estado.AUTORIZADO,  # legacy
        }
        if reord.estado not in estados_recepcionables:
            return Response(
                {"detail": f"No se puede recepcionar desde el estado: {reord.get_estado_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        observaciones = serializer.validated_data.get("observaciones_recepcion", "")
        ReordenamientoService.recepcionar(reord.id, request.user, observaciones)

        return Response(
            {"estado": Reordenamiento.Estado.RECEPCIONADO, "mensaje": "Recepción confirmada. Inventario actualizado."},
            status=status.HTTP_200_OK,
        )

    # ── Acción: comparativa-sedes ───────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="comparativa-sedes")
    def comparativa_sedes(self, request):
        """Compara disponibilidad de equipos por nombre en todas las unidades académicas o retorna resumen nacional."""
        nombre_equipo = request.query_params.get("nombre_equipo")
        service = InventoryAnalyticsService()
        
        if not nombre_equipo:
            # Si no hay término de búsqueda, retorna el panorama general nacional.
            data = service.obtener_resumen_nacional()
            return Response(data, status=status.HTTP_200_OK)

        data = service.comparar_sedes_para_equipo(nombre_equipo)
        return Response(data, status=status.HTTP_200_OK)
