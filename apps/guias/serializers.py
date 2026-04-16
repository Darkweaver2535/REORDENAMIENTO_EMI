# App: guias | Archivo: serializers.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear serializers para el módulo de guías con control de estado:
#
# 1. GuiaListSerializer (lectura, para listas):
#    - Campos: id, titulo, numero_practica, asignatura_id, asignatura_nombre,
#      portada_url, estado, created_at
#    - FILTRO: solo mostrar estado='publicado' para usuarios con rol estudiante/docente
#      Implementar esto en get_queryset del ViewSet, NO aquí
#
# 2. GuiaDetalleSerializer (lectura, para detalle):
#    - Todos los campos de GuiaListSerializer +
#    - pdf_url, resolucion_numero, aprobado_por_nombre
#    - equipos_requeridos: lista anidada con EquipoRequeridoSerializer
#
# 3. GuiaCrearSerializer (escritura, solo para admin/jefe):
#    - Campos editables: titulo, numero_practica, asignatura, portada_url, pdf_url
#    - estado siempre se crea como 'borrador' (no editable por el usuario)
#    - Validación: verificar que no exista ya una guía con el mismo
#      (asignatura, numero_practica)
#
# 4. GuiaEstadoSerializer (para cambios de estado - transiciones):
#    - Campos: estado, resolucion_numero, motivo_rechazo
#    - Validar que si estado='publicado', resolucion_numero no sea vacío
#
# 5. EquipoRequeridoSerializer:
#    - Campos: id, nombre_equipo_teorico, equipo_id, equipo_nombre,
#      cantidad_requerida, tiene_deficit, cantidad_deficit
