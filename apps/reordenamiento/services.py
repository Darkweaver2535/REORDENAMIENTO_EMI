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
#    - Verificar que usuario_autorizador.rol in ['decano', 'admin']
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

