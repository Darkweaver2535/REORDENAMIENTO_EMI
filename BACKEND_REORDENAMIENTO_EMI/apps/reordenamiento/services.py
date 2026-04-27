# App: reordenamiento | Archivo: services.py
# Sistema de gestión de laboratorios universitarios
#
# TAREA: Crear ReordenamientoService con la lógica de negocio del flujo de movimiento:
#
# class ReordenamientoService:
#
# 1. crear_solicitud(equipo_id, lab_origen_id, lab_destino_id,
#    cantidad, resolucion_numero, motivo, usuario_solicitante) -> Reordenamiento:
#    - Validar: resolucion_numero no vacío
#    - Validar: equipo pertenece al lab_origen
#    - Validar: cantidad <= equipo.cantidad_disponible()
#    - Validar: lab_origen != lab_destino
#    - Crear Reordenamiento con estado='pendiente'
#    - Registrar en AuditLog con accion='CREATE'
#    - Retornar el objeto creado
#    - Lanzar excepciones descriptivas (ValidationError) si algo falla
#
# 2. autorizar(reordenamiento_id, usuario_autorizador) -> Reordenamiento:
#    - Verificar que usuario_autorizador.rol in ['admin', 'jefe']
#    - Cambiar estado a 'autorizado', guardar autorizado_por y fecha_autorizacion
#    - Encolar tarea Celery: generar_pdf_reordenamiento.delay(reordenamiento_id)
#    - Registrar en AuditLog con accion='APPROVE'
#    - Retornar objeto actualizado
#
# 3. ejecutar_traslado(reordenamiento_id, usuario_ejecutor) -> Reordenamiento:
#    - Verificar que estado == 'autorizado'
#    - TRANSACCIÓN ATÓMICA (usar transaction.atomic):
#      a. Actualizar equipo.laboratorio_id = lab_destino_id
#      b. Actualizar equipo.cantidad_total -= cantidad_trasladada en origen
#         (o separar en un nuevo registro de Equipo en el destino)
#      c. Cambiar estado a 'ejecutado', guardar ejecutado_por y fecha_ejecucion
#    - Invalidar caché Redis de ambos laboratorios
#    - Registrar en AuditLog con accion='MOVE', datos_anteriores y datos_nuevos
#    - Retornar objeto actualizado

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.laboratorios.models import Equipo, Laboratorio
from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.usuarios.models import AuditLog


class ReordenamientoService:
	@staticmethod
	def _validar_rol_autorizador(usuario):
		rol = (getattr(usuario, "rol", "") or "").lower()
		if rol not in {"admin", "jefe"}:
			raise ValidationError(
				"Solo usuarios con rol ADMIN o JEFE pueden autorizar reordenamientos."
			)

	@staticmethod
	def _encolar_pdf(reordenamiento_id):
		# Import tardio para evitar dependencias circulares durante carga de apps.
		try:
			from apps.reordenamiento.tasks import generar_pdf_reordenamiento

			if hasattr(generar_pdf_reordenamiento, "delay"):
				generar_pdf_reordenamiento.delay(reordenamiento_id)
		except Exception:
			# Si Celery aun no esta listo, no bloquea la autorizacion.
			return

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
		if not str(resolucion_numero or "").strip():
			raise ValidationError("La resolucion_numero es obligatoria para crear la solicitud.")

		if lab_origen_id == lab_destino_id:
			raise ValidationError("El laboratorio de origen y destino no pueden ser iguales.")

		equipo = Equipo.objects.select_related("laboratorio").filter(id=equipo_id).first()
		if equipo is None:
			raise ValidationError("El equipo indicado no existe.")

		if equipo.laboratorio_id != lab_origen_id:
			raise ValidationError("El equipo no pertenece al laboratorio de origen especificado.")

		if cantidad <= 0:
			raise ValidationError("La cantidad a trasladar debe ser mayor a cero.")

		if cantidad > equipo.cantidad_disponible():
			raise ValidationError("La cantidad solicitada supera la cantidad disponible del equipo.")

		if not Laboratorio.objects.filter(id=lab_destino_id).exists():
			raise ValidationError("El laboratorio destino no existe.")

		reordenamiento = Reordenamiento.objects.create(
			equipo=equipo,
			laboratorio_origen_id=lab_origen_id,
			laboratorio_destino_id=lab_destino_id,
			cantidad_trasladada=cantidad,
			motivo=motivo or "",
			resolucion_numero=str(resolucion_numero).strip(),
			estado=Reordenamiento.Estado.PENDIENTE,
		)

		AuditLog.objects.create(
			tabla_afectada="Reordenamiento",
			registro_id=reordenamiento.id,
			accion=AuditLog.Accion.CREATE,
			usuario=usuario_solicitante,
			datos_nuevos={
				"equipo_id": equipo.id,
				"laboratorio_origen_id": lab_origen_id,
				"laboratorio_destino_id": lab_destino_id,
				"cantidad_trasladada": cantidad,
				"resolucion_numero": str(resolucion_numero).strip(),
				"estado": reordenamiento.estado,
			},
		)

		return reordenamiento

	@classmethod
	def autorizar(cls, reordenamiento_id, usuario_autorizador):
		cls._validar_rol_autorizador(usuario_autorizador)

		reordenamiento = Reordenamiento.objects.select_related("equipo").filter(id=reordenamiento_id).first()
		if reordenamiento is None:
			raise ValidationError("El reordenamiento indicado no existe.")

		if reordenamiento.estado != Reordenamiento.Estado.PENDIENTE:
			raise ValidationError("Solo se pueden autorizar reordenamientos en estado pendiente.")

		reordenamiento.estado = Reordenamiento.Estado.AUTORIZADO
		reordenamiento.autorizado_por = usuario_autorizador
		reordenamiento.fecha_autorizacion = timezone.now()
		reordenamiento.save(update_fields=["estado", "autorizado_por", "fecha_autorizacion", "updated_at"])

		cls._encolar_pdf(reordenamiento.id)

		AuditLog.objects.create(
			tabla_afectada="Reordenamiento",
			registro_id=reordenamiento.id,
			accion=AuditLog.Accion.APPROVE,
			usuario=usuario_autorizador,
			datos_nuevos={
				"estado": reordenamiento.estado,
				"autorizado_por_id": usuario_autorizador.id,
				"fecha_autorizacion": reordenamiento.fecha_autorizacion.isoformat(),
			},
		)

		return reordenamiento

	@classmethod
	def ejecutar_traslado(cls, reordenamiento_id, usuario_ejecutor):
		with transaction.atomic():
			reordenamiento = (
				Reordenamiento.objects.select_for_update()
				.select_related("equipo", "laboratorio_origen", "laboratorio_destino")
				.filter(id=reordenamiento_id)
				.first()
			)
			if reordenamiento is None:
				raise ValidationError("El reordenamiento indicado no existe.")

			if reordenamiento.estado != Reordenamiento.Estado.AUTORIZADO:
				raise ValidationError("Solo se pueden ejecutar reordenamientos en estado autorizado.")

			equipo = reordenamiento.equipo
			cantidad = reordenamiento.cantidad_trasladada

			if cantidad > equipo.cantidad_disponible():
				raise ValidationError("La cantidad a trasladar ya no esta disponible en el equipo de origen.")

			datos_anteriores = {
				"equipo_id": equipo.id,
				"laboratorio_id": equipo.laboratorio_id,
				"cantidad_total": equipo.cantidad_total,
				"cantidad_buena": equipo.cantidad_buena,
				"cantidad_regular": equipo.cantidad_regular,
				"cantidad_mala": equipo.cantidad_mala,
				"estado_reordenamiento": reordenamiento.estado,
			}

			# Descuenta primero de cantidad_buena y luego de cantidad_regular.
			restante = cantidad
			mover_buena = min(equipo.cantidad_buena, restante)
			equipo.cantidad_buena -= mover_buena
			restante -= mover_buena

			mover_regular = min(equipo.cantidad_regular, restante)
			equipo.cantidad_regular -= mover_regular
			restante -= mover_regular

			equipo.cantidad_total = max(0, equipo.cantidad_total - cantidad)
			equipo.laboratorio_id = reordenamiento.laboratorio_destino_id
			equipo.save(
				update_fields=[
					"cantidad_total",
					"cantidad_buena",
					"cantidad_regular",
					"laboratorio",
					"updated_at",
				]
			)

			reordenamiento.estado = Reordenamiento.Estado.EJECUTADO
			reordenamiento.ejecutado_por = usuario_ejecutor
			reordenamiento.fecha_ejecucion = timezone.now()
			reordenamiento.save(update_fields=["estado", "ejecutado_por", "fecha_ejecucion", "updated_at"])

			datos_nuevos = {
				"equipo_id": equipo.id,
				"laboratorio_id": equipo.laboratorio_id,
				"cantidad_total": equipo.cantidad_total,
				"cantidad_buena": equipo.cantidad_buena,
				"cantidad_regular": equipo.cantidad_regular,
				"cantidad_mala": equipo.cantidad_mala,
				"estado_reordenamiento": reordenamiento.estado,
			}

			AuditLog.objects.create(
				tabla_afectada="Equipo",
				registro_id=equipo.id,
				accion=AuditLog.Accion.MOVE,
				usuario=usuario_ejecutor,
				datos_anteriores=datos_anteriores,
				datos_nuevos=datos_nuevos,
			)

		InventoryAnalyticsService.invalidar_cache_laboratorio(reordenamiento.laboratorio_origen_id)
		InventoryAnalyticsService.invalidar_cache_laboratorio(reordenamiento.laboratorio_destino_id)

		return reordenamiento

