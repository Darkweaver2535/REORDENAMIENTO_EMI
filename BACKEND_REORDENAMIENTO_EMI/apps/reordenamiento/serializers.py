from rest_framework import serializers

from apps.laboratorios.models import Equipo, Laboratorio
from apps.reordenamiento.models import Reordenamiento

EXTENSIONES_PDF = {"pdf"}
EXTENSIONES_DOCS = {"pdf", "jpg", "jpeg", "png"}

# Mapeo conservador de content_type MIME → extensiones aceptadas.
# No requiere python-magic; usa el Content-Type declarado por el cliente.
# Es una defensa adicional, no un reemplazo del análisis de bytes.
_CONTENT_TYPE_PERMITIDOS = {
    "pdf": {"application/pdf"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
}


def _validar_extension(archivo, extensiones_permitidas, campo="documento_respaldo"):
    """Valida la extensión del nombre de archivo y el content_type MIME declarado.

    No usa python-magic (no inspecciona bytes reales), pero rechaza combinaciones
    inconsistentes como archivo.pdf con content_type image/jpeg.

    Notas:
    - El content_type viene del cliente y puede ser manipulado; se usa como capa
      adicional de defensa, no como garantía definitiva de integridad.
    - Si el cliente no envía content_type (e.g. tests), solo se valida la extensión.
    """
    nombre = str(archivo.name or "")
    if "." not in nombre:
        raise serializers.ValidationError(
            {campo: "El archivo no tiene extensión. Se requiere un nombre válido."}
        )

    ext = nombre.lower().rsplit(".", 1)[-1]

    # ── 1. Extensión ──────────────────────────────────────────────────────
    if ext not in extensiones_permitidas:
        lista = ", ".join(sorted(extensiones_permitidas))
        raise serializers.ValidationError(
            {campo: f"Extensión '.{ext}' no permitida. Usa: {lista}."}
        )

    # ── 2. content_type declarado ─────────────────────────────────────────
    ct = getattr(archivo, "content_type", None)
    if ct:
        ct_clean = ct.split(";")[0].strip().lower()  # quita parámetros como ;charset=...
        tipos_permitidos_para_ext = _CONTENT_TYPE_PERMITIDOS.get(ext)
        if tipos_permitidos_para_ext and ct_clean not in tipos_permitidos_para_ext:
            tipos_str = ", ".join(sorted(tipos_permitidos_para_ext))
            raise serializers.ValidationError(
                {
                    campo: (
                        f"El archivo tiene extensión '.{ext}' pero el tipo MIME declarado "
                        f"es '{ct_clean}'. Se esperaba: {tipos_str}."
                    )
                }
            )


class ReordenamientoListSerializer(serializers.ModelSerializer):
    equipo_nombre = serializers.SerializerMethodField()
    laboratorio_origen_nombre = serializers.SerializerMethodField()
    laboratorio_destino_nombre = serializers.SerializerMethodField()
    es_inter_sede = serializers.SerializerMethodField()
    tiene_documento = serializers.SerializerMethodField()
    tipo_movimiento_display = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    documento_url = serializers.SerializerMethodField()

    class Meta:
        model = Reordenamiento
        fields = (
            "id",
            "tipo_movimiento",
            "tipo_movimiento_display",
            "equipo_id",
            "equipo_nombre",
            "laboratorio_origen_nombre",
            "laboratorio_destino_nombre",
            "cantidad_trasladada",
            "estado",
            "estado_display",
            "numero_documento",
            "resolucion_numero",
            "tiene_documento",
            "documento_url",
            "fecha_retorno_prevista",
            "es_inter_sede",
            "created_at",
        )

    def get_equipo_nombre(self, obj):
        return obj.equipo.nombre if obj.equipo_id else None

    def get_laboratorio_origen_nombre(self, obj):
        return obj.laboratorio_origen.nombre if obj.laboratorio_origen_id else None

    def get_laboratorio_destino_nombre(self, obj):
        return obj.laboratorio_destino.nombre if obj.laboratorio_destino_id else None

    def get_es_inter_sede(self, obj):
        return obj.es_inter_sede()

    def get_tiene_documento(self, obj):
        return bool(obj.documento_respaldo)

    def get_tipo_movimiento_display(self, obj):
        return obj.get_tipo_movimiento_display()

    def get_estado_display(self, obj):
        return obj.get_estado_display()

    def get_documento_url(self, obj):
        if not obj.documento_respaldo:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.documento_respaldo.url)
        return obj.documento_respaldo.url


class ReordenamientoDetalleSerializer(ReordenamientoListSerializer):
    aprobado_por_nombre = serializers.SerializerMethodField()
    autorizado_por_nombre = serializers.SerializerMethodField()
    ejecutado_por_nombre = serializers.SerializerMethodField()
    recepcionado_por_nombre = serializers.SerializerMethodField()

    class Meta(ReordenamientoListSerializer.Meta):
        fields = ReordenamientoListSerializer.Meta.fields + (
            "motivo",
            "tipo_documento",
            "documento_url",
            "aprobado_por_nombre",
            "autorizado_por_nombre",
            "ejecutado_por_nombre",
            "fecha_autorizacion",
            "fecha_ejecucion",
            "fecha_recepcion",
            "recepcionado_por_nombre",
            "observaciones_recepcion",
            "pdf_reporte_url",
        )

    def get_aprobado_por_nombre(self, obj):
        if obj.aprobado_por_id:
            return obj.aprobado_por.nombre_completo
        if obj.autorizado_por_id:
            return obj.autorizado_por.nombre_completo
        return None

    def get_autorizado_por_nombre(self, obj):
        return obj.autorizado_por.nombre_completo if obj.autorizado_por_id else None

    def get_ejecutado_por_nombre(self, obj):
        return obj.ejecutado_por.nombre_completo if obj.ejecutado_por_id else None

    def get_recepcionado_por_nombre(self, obj):
        return obj.recepcionado_por.nombre_completo if obj.recepcionado_por_id else None


class CrearReordenamientoSerializer(serializers.Serializer):
    """Serializer para crear un nuevo reordenamiento. Soporta multipart/form-data.

    Validaciones por tipo:
      REASIGNACION_DEFINITIVA — origen, destino, numero_documento y PDF obligatorios.
      PRESTAMO                — origen, destino, fecha_retorno_prevista obligatorios; doc opcional.
      COMPRA                  — destino obligatorio; origen null permitido.

    ⚠ COMPRA NO crea un equipo nuevo.
      Sirve para documentar la recepción/ingreso de un activo que ya existe en la BD
      (fue dado de alta previamente por Activos Fijos o el módulo de Inventario).
      El campo equipo_id es obligatorio y debe corresponder a un Equipo existente.
      Si necesitas dar de alta un equipo nuevo, usa primero POST /api/v1/equipos/.
    """

    tipo_movimiento = serializers.ChoiceField(
        choices=Reordenamiento.TipoMovimiento.choices,
    )
    equipo_id = serializers.IntegerField()
    laboratorio_origen_id = serializers.IntegerField(required=False, allow_null=True)
    laboratorio_destino_id = serializers.IntegerField()
    cantidad_trasladada = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(required=False, allow_blank=True, default="")
    numero_documento = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    tipo_documento = serializers.ChoiceField(
        choices=Reordenamiento.TipoDocumento.choices,
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    documento_respaldo = serializers.FileField(required=False, allow_null=True)
    fecha_retorno_prevista = serializers.DateField(required=False, allow_null=True)

    def validate(self, attrs):
        tipo = attrs.get("tipo_movimiento")
        equipo_id = attrs.get("equipo_id")
        lab_origen_id = attrs.get("laboratorio_origen_id")
        lab_destino_id = attrs.get("laboratorio_destino_id")
        cantidad = attrs.get("cantidad_trasladada")
        num_doc = attrs.get("numero_documento", "")
        archivo = attrs.get("documento_respaldo")

        # ── Validar existencia de equipo ──────────────────────────────────
        try:
            equipo = Equipo.objects.select_related("laboratorio").get(id=equipo_id)
        except Equipo.DoesNotExist as err:
            raise serializers.ValidationError({"equipo_id": "El equipo no existe."}) from err

        # ── Validar cantidad disponible ───────────────────────────────────
        # FIX #10: la COMPRA documenta la recepción/ingreso de un activo que viene
        # de fuera (puede tener disponibilidad 0 en la BD), por eso no se valida
        # contra el stock existente. El service ya hace esta misma excepción
        # (services.py crear_movimiento). Antes el serializer bloqueaba la COMPRA.
        if tipo != Reordenamiento.TipoMovimiento.COMPRA:
            disp = equipo.cantidad_disponible()
            if cantidad > disp:
                raise serializers.ValidationError(
                    {"cantidad_trasladada": f"Solo hay {disp} unidades disponibles del equipo."}
                )

        # ── Validar laboratorios ──────────────────────────────────────────
        if lab_origen_id:
            if not Laboratorio.objects.filter(id=lab_origen_id).exists():
                raise serializers.ValidationError(
                    {"laboratorio_origen_id": "El laboratorio de origen no existe."}
                )
            if equipo.laboratorio_id != lab_origen_id:
                raise serializers.ValidationError(
                    {"equipo_id": "El equipo no pertenece al laboratorio de origen especificado."}
                )

        if not Laboratorio.objects.filter(id=lab_destino_id).exists():
            raise serializers.ValidationError(
                {"laboratorio_destino_id": "El laboratorio de destino no existe."}
            )

        if lab_origen_id and lab_origen_id == lab_destino_id:
            raise serializers.ValidationError(
                {
                    "laboratorio_destino_id": "El laboratorio de destino debe ser diferente del origen."
                }
            )

        # ── Validaciones por tipo de movimiento ───────────────────────────
        TIPO = Reordenamiento.TipoMovimiento

        if tipo == TIPO.REASIGNACION_DEFINITIVA:
            if not lab_origen_id:
                raise serializers.ValidationError(
                    {"laboratorio_origen_id": "Requerido para Reasignación definitiva."}
                )
            if not num_doc.strip():
                raise serializers.ValidationError(
                    {
                        "numero_documento": "El número de documento es obligatorio para Reasignación definitiva."
                    }
                )
            if not archivo:
                raise serializers.ValidationError(
                    {
                        "documento_respaldo": "El documento en PDF es obligatorio para Reasignación definitiva."
                    }
                )
            _validar_extension(archivo, EXTENSIONES_PDF)

        elif tipo == TIPO.PRESTAMO:
            if not lab_origen_id:
                raise serializers.ValidationError(
                    {"laboratorio_origen_id": "Requerido para Préstamo."}
                )
            if not attrs.get("fecha_retorno_prevista"):
                raise serializers.ValidationError(
                    {
                        "fecha_retorno_prevista": "La fecha de retorno prevista es obligatoria para Préstamos."
                    }
                )
            if archivo:
                _validar_extension(archivo, EXTENSIONES_DOCS)

        elif tipo == TIPO.COMPRA:
            # COMPRA no crea equipos; documenta la recepción de un activo ya existente.
            # No se valida que el equipo ya esté en el laboratorio destino (viene de fuera).
            # El equipo_id es obligatorio; ya fue validado arriba (Equipo.DoesNotExist).
            if archivo:
                _validar_extension(archivo, EXTENSIONES_DOCS)

        return attrs


class AprobarReordenamientoSerializer(serializers.Serializer):
    """Serializer para aprobar un reordenamiento (equivalente a la acción legacy 'autorizar')."""

    comentario = serializers.CharField(required=False, allow_blank=True, default="")


class AutorizarReordenamientoSerializer(AprobarReordenamientoSerializer):
    """Alias legacy para compatibilidad de clientes existentes."""

    comentario_autorizacion = serializers.CharField(required=False, allow_blank=True, default="")


class RecepcinarReordenamientoSerializer(serializers.Serializer):
    """Serializer para confirmar recepción de un reordenamiento."""

    observaciones_recepcion = serializers.CharField(required=False, allow_blank=True, default="")
