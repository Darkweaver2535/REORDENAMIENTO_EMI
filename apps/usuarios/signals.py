# App: usuarios | Archivo: signals.py
# Sistema de gestión de laboratorios universitarios - Django Signals
#
# TAREA: Crear señales Django para auditoría automática de cambios críticos.
# Conectar usando @receiver decorador.
#
# 1. Signal post_save en modelo Guia:
#    Cuando estado cambia a 'publicado': registrar AuditLog con accion='PUBLISH'
#    Cuando estado cambia a 'pendiente': registrar AuditLog con accion='UPDATE'
#
# 2. Signal post_save en modelo Reordenamiento:
#    Cuando estado cambia a 'autorizado': registrar AuditLog con accion='APPROVE'
#    Cuando estado cambia a 'ejecutado': registrar AuditLog con accion='MOVE'
#
# 3. Signal post_save en modelo Equipo:
#    Cuando laboratorio_id cambia: registrar AuditLog con accion='MOVE'
#    Incluir datos_anteriores={lab_anterior} y datos_nuevos={lab_nuevo}
#    Invalidar caché Redis del laboratorio afectado
#
# Recordar registrar las señales en el método ready() del AppConfig en apps.py
# de la app usuarios (o en cada app correspondiente)
