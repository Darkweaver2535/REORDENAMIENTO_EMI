# App: reordenamiento | Archivo: services.py
# Sistema de gestión de laboratorios universitarios
#
# Lógica de negocio del flujo de movimiento de equipos.
#
# Tipos soportados: REASIGNACION_DEFINITIVA, PRESTAMO, COMPRA
# Flujo: PENDIENTE_APROBACION → APROBADO → EN_TRANSITO → RECEPCIONADO
#
# Aprobador: can_approve_reordenamiento(user) — ver permissions.py
# Activos Fijos: recibe notificación pasiva (notify_activos_fijos), no aprueba.

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.laboratorios.models import Equipo, Laboratorio
from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.usuarios.models import AuditLog
from apps.usuarios.permissions import can_approve_reordenamiento, notify_activos_fijos


class ReordenamientoService:

    @staticmethod
    def _encolar_pdf(reordenamiento_id):
        """Encola tarea Celery si está disponible; falla silenciosamente si no."""
        try:
            from apps.reordenamiento.tasks import generar_pdf_reordenamiento
            if hasattr(generar_pdf_reordenamiento, "delay"):
                generar_pdf_reordenamiento.delay(reordenamiento_id)
        except Exception:
            return

    @classmethod
    def crear_movimiento(
        cls,
        tipo_movimiento,
        equipo_id,
        lab_destino_id,
        cantidad,
        motivo="",
        numero_documento="",
        tipo_documento=None,
        documento_respaldo=None,
        fecha_retorno_prevista=None,
        lab_origen_id=None,
        usuario_solicitante=None,
    ):
        """Crea un nuevo reordenamiento validado por tipo de movimiento.

        Notas:
        - REASIGNACION_DEFINITIVA: origen, numero_documento y PDF son obligatorios (validados en serializer).
        - PRESTAMO: origen y fecha_retorno_prevista son obligatorios; documento opcional.
        - COMPRA: solo destino es obligatorio; origen puede ser None.
        """
        TIPO = Reordenamiento.TipoMovimiento

        equipo = Equipo.objects.select_related("laboratorio").filter(id=equipo_id).first()
        if equipo is None:
            raise ValidationError("El equipo indicado no existe.")

        if not Laboratorio.objects.filter(id=lab_destino_id).exists():
            raise ValidationError("El laboratorio destino no existe.")

        if lab_origen_id and lab_origen_id == lab_destino_id:
            raise ValidationError("El laboratorio de origen y destino no pueden ser iguales.")

        if tipo_movimiento != TIPO.COMPRA and cantidad > equipo.cantidad_disponible():
            raise ValidationError("La cantidad solicitada supera la cantidad disponible del equipo.")

        reordenamiento = Reordenamiento.objects.create(
            tipo_movimiento=tipo_movimiento,
            equipo=equipo,
            laboratorio_origen_id=lab_origen_id,
            laboratorio_destino_id=lab_destino_id,
            cantidad_trasladada=cantidad,
            motivo=motivo or "",
            numero_documento=str(numero_documento or "").strip(),
            resolucion_numero=str(numero_documento or "")[:50].strip(),
            tipo_documento=tipo_documento,
            documento_respaldo=documento_respaldo,
            fecha_retorno_prevista=fecha_retorno_prevista,
            estado=Reordenamiento.Estado.PENDIENTE_APROBACION,
        )

        AuditLog.objects.create(
            tabla_afectada="Reordenamiento",
            registro_id=reordenamiento.id,
            accion=AuditLog.Accion.CREATE,
            usuario=usuario_solicitante,
            datos_nuevos={
                "tipo_movimiento": tipo_movimiento,
                "equipo_id": equipo.id,
                "laboratorio_origen_id": lab_origen_id,
                "laboratorio_destino_id": lab_destino_id,
                "cantidad_trasladada": cantidad,
                "numero_documento": reordenamiento.numero_documento,
                "estado": reordenamiento.estado,
            },
        )

        return reordenamiento

    @classmethod
    def crear_solicitud(
        cls,
        equipo_id,
        lab_origen_id,
        lab_destino_id,
        cantidad,
        resolucion_numero,
        motivo,
        usuario_solicitante,
    ):
        """Alias legacy de crear_movimiento para compatibilidad con código existente.

        Trata el movimiento como REASIGNACION_DEFINITIVA.
        """
        return cls.crear_movimiento(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo_id=equipo_id,
            lab_origen_id=lab_origen_id,
            lab_destino_id=lab_destino_id,
            cantidad=cantidad,
            numero_documento=resolucion_numero,
            motivo=motivo,
            usuario_solicitante=usuario_solicitante,
        )

    @classmethod
    def aprobar(cls, reordenamiento_id, usuario_aprobador):
        """Aprueba el reordenamiento. Aprobador determinado por can_approve_reordenamiento().

        - Cambia estado a APROBADO
        - Notifica a Activos Fijos
        - Encola generación PDF si aplica
        """
        if not can_approve_reordenamiento(usuario_aprobador):
            raise ValidationError("No tienes permiso para aprobar reordenamientos.")

        reordenamiento = (
            Reordenamiento.objects
            .select_related("equipo")
            .filter(id=reordenamiento_id)
            .first()
        )
        if reordenamiento is None:
            raise ValidationError("El reordenamiento indicado no existe.")

        estados_aprobables = {
            Reordenamiento.Estado.PENDIENTE_APROBACION,
            # Legacy
            Reordenamiento.Estado.PENDIENTE,
        }
        if reordenamiento.estado not in estados_aprobables:
            raise ValidationError(
                f"Solo se pueden aprobar reordenamientos en estado 'Pendiente de aprobación'. "
                f"Estado actual: {reordenamiento.get_estado_display()}."
            )

        reordenamiento.estado = Reordenamiento.Estado.APROBADO
        reordenamiento.aprobado_por = usuario_aprobador
        reordenamiento.autorizado_por = usuario_aprobador  # compatibilidad legacy
        reordenamiento.fecha_autorizacion = timezone.now()
        reordenamiento.save(update_fields=[
            "estado", "aprobado_por", "autorizado_por", "fecha_autorizacion", "updated_at"
        ])

        cls._encolar_pdf(reordenamiento.id)
        notify_activos_fijos(reordenamiento, evento="aprobado")

        AuditLog.objects.create(
            tabla_afectada="Reordenamiento",
            registro_id=reordenamiento.id,
            accion=AuditLog.Accion.APPROVE,
            usuario=usuario_aprobador,
            datos_nuevos={
                "estado": reordenamiento.estado,
                "aprobado_por_id": usuario_aprobador.id,
                "fecha_autorizacion": reordenamiento.fecha_autorizacion.isoformat(),
            },
        )

        return reordenamiento

    @classmethod
    def autorizar(cls, reordenamiento_id, usuario_autorizador):
        """Alias legacy de aprobar() para compatibilidad con código existente."""
        return cls.aprobar(reordenamiento_id, usuario_autorizador)

    @classmethod
    def marcar_en_transito(cls, reordenamiento_id, usuario_ejecutor):
        """Marca el reordenamiento como EN_TRANSITO (ex-'ejecutar')."""
        with transaction.atomic():
            reordenamiento = (
                Reordenamiento.objects.select_for_update(of=("self",))
                .select_related("equipo", "laboratorio_origen", "laboratorio_destino")
                .filter(id=reordenamiento_id)
                .first()
            )
            if reordenamiento is None:
                raise ValidationError("El reordenamiento indicado no existe.")

            estados_validos = {
                Reordenamiento.Estado.APROBADO,
                # Legacy
                Reordenamiento.Estado.AUTORIZADO,
            }
            if reordenamiento.estado not in estados_validos:
                raise ValidationError(
                    f"El reordenamiento debe estar Aprobado para marcarlo En tránsito. "
                    f"Estado actual: {reordenamiento.get_estado_display()}."
                )

            reordenamiento.estado = Reordenamiento.Estado.EN_TRANSITO
            reordenamiento.ejecutado_por = usuario_ejecutor
            reordenamiento.fecha_ejecucion = timezone.now()
            reordenamiento.save(update_fields=[
                "estado", "ejecutado_por", "fecha_ejecucion", "updated_at"
            ])

        AuditLog.objects.create(
            tabla_afectada="Reordenamiento",
            registro_id=reordenamiento.id,
            accion=AuditLog.Accion.UPDATE,
            usuario=usuario_ejecutor,
            datos_nuevos={"estado": reordenamiento.estado},
        )

        return reordenamiento

    @classmethod
    def ejecutar_traslado(cls, reordenamiento_id, usuario_ejecutor):
        """Alias legacy de marcar_en_transito() para compatibilidad con código existente."""
        return cls.marcar_en_transito(reordenamiento_id, usuario_ejecutor)

    @classmethod
    def recepcionar(cls, reordenamiento_id, usuario_receptor, observaciones=""):
        """Confirma recepción física del equipo.

        - Cambia estado a RECEPCIONADO (estado final)
        - Mueve el equipo al laboratorio destino y descuenta el stock en origen
        - Notifica a Activos Fijos
        - Registra en AuditLog
        """
        with transaction.atomic():
            reordenamiento = (
                Reordenamiento.objects.select_for_update(of=("self",))
                .select_related("equipo", "laboratorio_origen", "laboratorio_destino")
                .filter(id=reordenamiento_id)
                .first()
            )
            if reordenamiento is None:
                raise ValidationError("El reordenamiento indicado no existe.")

            estados_validos = {
                Reordenamiento.Estado.EN_TRANSITO,
                Reordenamiento.Estado.APROBADO,
                # Legacy
                Reordenamiento.Estado.EJECUTADO,
                Reordenamiento.Estado.AUTORIZADO,
            }
            if reordenamiento.estado not in estados_validos:
                raise ValidationError(
                    f"El reordenamiento no puede recepcionarse en estado actual: "
                    f"{reordenamiento.get_estado_display()}."
                )

            equipo = reordenamiento.equipo
            cantidad = reordenamiento.cantidad_trasladada
            tipo = reordenamiento.tipo_movimiento

            datos_anteriores = {
                "equipo_id": equipo.id,
                "laboratorio_id": equipo.laboratorio_id,
                "cantidad_total": equipo.cantidad_total,
                "cantidad_buena": equipo.cantidad_buena,
                "cantidad_regular": equipo.cantidad_regular,
                "cantidad_mala": equipo.cantidad_mala,
                "estado_reordenamiento": reordenamiento.estado,
            }

            # Para COMPRA o PRESTAMO, el stock del equipo no se mueve del origen.
            # Para REASIGNACION, se mueve físicamente con descuento de stock.
            if tipo == Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA:
                restante = cantidad
                mover_buena = min(equipo.cantidad_buena, restante)
                equipo.cantidad_buena -= mover_buena
                restante -= mover_buena
                mover_regular = min(equipo.cantidad_regular, restante)
                equipo.cantidad_regular -= mover_regular
                equipo.cantidad_total = max(0, equipo.cantidad_total - cantidad)
                equipo.laboratorio_id = reordenamiento.laboratorio_destino_id
                equipo.save(update_fields=[
                    "cantidad_total", "cantidad_buena", "cantidad_regular", "laboratorio", "updated_at"
                ])
            elif tipo == Reordenamiento.TipoMovimiento.COMPRA:
                # En compra, el equipo ya debería estar en el destino; solo se confirma.
                equipo.laboratorio_id = reordenamiento.laboratorio_destino_id
                equipo.save(update_fields=["laboratorio", "updated_at"])

            reordenamiento.estado = Reordenamiento.Estado.RECEPCIONADO
            reordenamiento.recepcionado_por = usuario_receptor
            reordenamiento.fecha_recepcion = timezone.now()
            reordenamiento.observaciones_recepcion = observaciones or ""
            reordenamiento.save(update_fields=[
                "estado", "recepcionado_por", "fecha_recepcion",
                "observaciones_recepcion", "updated_at"
            ])

            datos_nuevos = {
                "equipo_id": equipo.id,
                "laboratorio_id": equipo.laboratorio_id,
                "cantidad_total": equipo.cantidad_total,
                "estado_reordenamiento": reordenamiento.estado,
            }

            AuditLog.objects.create(
                tabla_afectada="Equipo",
                registro_id=equipo.id,
                accion=AuditLog.Accion.MOVE,
                usuario=usuario_receptor,
                datos_anteriores=datos_anteriores,
                datos_nuevos=datos_nuevos,
            )

        InventoryAnalyticsService.invalidar_cache_laboratorio(reordenamiento.laboratorio_destino_id)
        if reordenamiento.laboratorio_origen_id:
            InventoryAnalyticsService.invalidar_cache_laboratorio(reordenamiento.laboratorio_origen_id)

        notify_activos_fijos(reordenamiento, evento="recepcionado")

        return reordenamiento
