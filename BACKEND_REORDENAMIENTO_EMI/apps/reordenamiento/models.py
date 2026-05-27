# App: reordenamiento | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# Soporta 3 tipos de movimiento:
#   REASIGNACION_DEFINITIVA — movimiento permanente, requiere resolución y documento PDF
#   PRESTAMO                — movimiento temporal, requiere fecha_retorno_prevista; doc opcional
#   COMPRA                  — ingreso de equipo nuevo, sin origen obligatorio; doc opcional
#
# Flujo de estados:
#   BORRADOR → PENDIENTE_APROBACION → APROBADO → EN_TRANSITO → RECEPCIONADO
#                                  ↘ RECHAZADO
#                                  (CANCELADO disponible en cualquier punto)
#
# Aprobación: can_approve_reordenamiento(user) — actualmente mapeado a admin|jefe.
#             Cuando exista rol DNCIT, solo se actualiza ese helper en permissions.py.
# Activos Fijos: recibe notificación pasiva al aprobarse y al recepcionarse.

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.estructura_academica.models import BaseModel


def _upload_documento(instance, filename):
    """Ruta dinámica de subida: reordenamientos/<tipo>/<id>/<filename>"""
    tipo = (instance.tipo_movimiento or "sin_tipo").lower()
    pk = instance.pk or "nuevo"
    return f"reordenamientos/{tipo}/{pk}/{filename}"


class Reordenamiento(BaseModel):
    # ── Tipo de movimiento ──────────────────────────────────────────────────
    class TipoMovimiento(models.TextChoices):
        REASIGNACION_DEFINITIVA = "REASIGNACION_DEFINITIVA", "Reasignación definitiva"
        PRESTAMO                = "PRESTAMO",                "Préstamo"
        COMPRA                  = "COMPRA",                  "Compra"

    # ── Tipo de documento ───────────────────────────────────────────────────
    class TipoDocumento(models.TextChoices):
        RESOLUCION   = "RESOLUCION",   "Resolución"
        AUTORIZACION = "AUTORIZACION", "Autorización"
        FACTURA      = "FACTURA",      "Factura"
        ACTA_ENTREGA = "ACTA_ENTREGA", "Acta de entrega"
        OTRO         = "OTRO",         "Otro"

    # ── Estado del flujo ────────────────────────────────────────────────────
    class Estado(models.TextChoices):
        BORRADOR             = "borrador",             "Borrador"
        PENDIENTE_APROBACION = "pendiente_aprobacion", "Pendiente de aprobación"
        APROBADO             = "aprobado",             "Aprobado"
        RECHAZADO            = "rechazado",            "Rechazado"
        EN_TRANSITO          = "en_transito",          "En tránsito"
        RECEPCIONADO         = "recepcionado",         "Recepcionado"
        CANCELADO            = "cancelado",            "Cancelado"
        # Legacy — conservado para compatibilidad con registros históricos
        PENDIENTE   = "pendiente",   "Pendiente (legacy)"
        AUTORIZADO  = "autorizado",  "Autorizado (legacy)"
        EJECUTADO   = "ejecutado",   "Ejecutado (legacy)"

    # ── Relaciones principales ──────────────────────────────────────────────
    tipo_movimiento = models.CharField(
        max_length=30,
        choices=TipoMovimiento.choices,
        default=TipoMovimiento.REASIGNACION_DEFINITIVA,
        verbose_name="Tipo de movimiento",
    )
    equipo = models.ForeignKey(
        "laboratorios.Equipo",
        on_delete=models.PROTECT,
        related_name="reordenamientos",
    )
    laboratorio_origen = models.ForeignKey(
        "laboratorios.Laboratorio",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reordenamientos_origen",
        help_text="Requerido para REASIGNACION y PRESTAMO. Nulo para COMPRA.",
    )
    laboratorio_destino = models.ForeignKey(
        "laboratorios.Laboratorio",
        on_delete=models.PROTECT,
        related_name="reordenamientos_destino",
    )
    cantidad_trasladada = models.IntegerField(validators=[MinValueValidator(1)])
    motivo = models.TextField(blank=True)

    # ── Documentación ───────────────────────────────────────────────────────
    # numero_documento es el campo canónico. resolucion_numero se mantiene
    # en BD para no perder datos históricos; ambos se sincronizan en save().
    numero_documento = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Número de documento",
        help_text="Obligatorio para REASIGNACION_DEFINITIVA.",
    )
    resolucion_numero = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Número de resolución (legacy)",
        help_text="Campo legacy mantenido por compatibilidad. Usa numero_documento.",
    )
    tipo_documento = models.CharField(
        max_length=20,
        choices=TipoDocumento.choices,
        null=True,
        blank=True,
        verbose_name="Tipo de documento",
    )
    documento_respaldo = models.FileField(
        upload_to=_upload_documento,
        null=True,
        blank=True,
        verbose_name="Documento de respaldo",
        help_text="PDF para REASIGNACION; PDF/imagen opcionales para PRESTAMO y COMPRA.",
    )

    # ── Estado ──────────────────────────────────────────────────────────────
    estado = models.CharField(
        max_length=25,
        choices=Estado.choices,
        default=Estado.PENDIENTE_APROBACION,
    )

    # ── Fecha de retorno (solo PRESTAMO) ────────────────────────────────────
    fecha_retorno_prevista = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de retorno prevista",
        help_text="Obligatorio para movimientos tipo PRESTAMO.",
    )

    # ── Aprobación ──────────────────────────────────────────────────────────
    # aprobado_por es el campo canónico nuevo.
    # autorizado_por se mantiene por compatibilidad con registros históricos.
    aprobado_por = models.ForeignKey(
        "usuarios.Usuario",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reordenamientos_aprobados",
        verbose_name="Aprobado por",
    )
    autorizado_por = models.ForeignKey(
        "usuarios.Usuario",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reordenamientos_autorizados",
        verbose_name="Autorizado por (legacy)",
    )
    ejecutado_por = models.ForeignKey(
        "usuarios.Usuario",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reordenamientos_ejecutados",
    )
    pdf_reporte_url = models.URLField(max_length=500, blank=True)
    fecha_autorizacion = models.DateTimeField(null=True, blank=True)
    fecha_ejecucion = models.DateTimeField(null=True, blank=True)

    # ── Recepción ───────────────────────────────────────────────────────────
    fecha_recepcion = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de recepción",
    )
    recepcionado_por = models.ForeignKey(
        "usuarios.Usuario",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reordenamientos_recepcionados",
        verbose_name="Recepcionado por",
    )
    observaciones_recepcion = models.TextField(
        blank=True,
        verbose_name="Observaciones de recepción",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Reordenamiento"
        verbose_name_plural = "Reordenamientos"

    def __str__(self):
        tipo = self.get_tipo_movimiento_display()
        origen = self.laboratorio_origen.nombre if self.laboratorio_origen else "Compra"
        destino = self.laboratorio_destino.nombre if self.laboratorio_destino_id else "—"
        return (
            f"[{tipo}] #{self.pk or 'nuevo'} — {self.equipo.nombre}: "
            f"{origen} → {destino}"
        )

    def save(self, *args, **kwargs):
        """Sincroniza numero_documento ↔ resolucion_numero para compatibilidad legacy."""
        if self.numero_documento and not self.resolucion_numero:
            self.resolucion_numero = self.numero_documento[:50]
        elif self.resolucion_numero and not self.numero_documento:
            self.numero_documento = self.resolucion_numero
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        tipo = self.tipo_movimiento

        # ── Validaciones comunes ──────────────────────────────────────────
        if self.laboratorio_origen_id and self.laboratorio_destino_id:
            if self.laboratorio_origen_id == self.laboratorio_destino_id:
                raise ValidationError(
                    {"laboratorio_destino": "El laboratorio de origen y destino no pueden ser iguales."}
                )

        if self.equipo_id and self.cantidad_trasladada:
            disp = self.equipo.cantidad_disponible()
            if self.cantidad_trasladada > disp:
                raise ValidationError(
                    {"cantidad_trasladada": f"Solo hay {disp} unidades disponibles del equipo."}
                )

        # ── Validaciones por tipo ─────────────────────────────────────────
        if tipo == self.TipoMovimiento.REASIGNACION_DEFINITIVA:
            if not self.laboratorio_origen_id:
                raise ValidationError(
                    {"laboratorio_origen": "Requerido para Reasignación definitiva."}
                )
            if not self.numero_documento and not self.resolucion_numero:
                raise ValidationError(
                    {"numero_documento": "El número de resolución/documento es obligatorio para Reasignación definitiva."}
                )
            if self.documento_respaldo:
                ext = str(self.documento_respaldo.name).lower().rsplit(".", 1)[-1]
                if ext not in {"pdf"}:
                    raise ValidationError(
                        {"documento_respaldo": "Para Reasignación definitiva solo se aceptan archivos PDF."}
                    )

        elif tipo == self.TipoMovimiento.PRESTAMO:
            if not self.laboratorio_origen_id:
                raise ValidationError(
                    {"laboratorio_origen": "Requerido para Préstamo."}
                )
            if not self.fecha_retorno_prevista:
                raise ValidationError(
                    {"fecha_retorno_prevista": "La fecha de retorno prevista es obligatoria para Préstamos."}
                )
            if self.documento_respaldo:
                ext = str(self.documento_respaldo.name).lower().rsplit(".", 1)[-1]
                if ext not in {"pdf", "jpg", "jpeg", "png"}:
                    raise ValidationError(
                        {"documento_respaldo": "Se permiten PDF o imagen (JPG/PNG) para Préstamos."}
                    )

        elif tipo == self.TipoMovimiento.COMPRA:
            if self.documento_respaldo:
                ext = str(self.documento_respaldo.name).lower().rsplit(".", 1)[-1]
                if ext not in {"pdf", "jpg", "jpeg", "png"}:
                    raise ValidationError(
                        {"documento_respaldo": "Se permiten PDF o imagen (JPG/PNG) para Compras."}
                    )

        # ── Recepción ─────────────────────────────────────────────────────
        if self.estado == self.Estado.RECEPCIONADO and not self.fecha_recepcion:
            raise ValidationError(
                {"fecha_recepcion": "Se requiere fecha de recepción al marcar como Recepcionado."}
            )

    def es_inter_sede(self):
        if not self.laboratorio_origen_id or not self.laboratorio_destino_id:
            return False
        return (
            self.laboratorio_origen.unidad_academica_id
            != self.laboratorio_destino.unidad_academica_id
        )
