# App: reordenamiento | Archivo: tasks.py
# Sistema de gestión de laboratorios universitarios - Celery + Django
#
# TAREA: Crear tareas Celery para generación asíncrona de reportes PDF:
#
# 1. @shared_task generar_pdf_reordenamiento(reordenamiento_id):
#    - Obtener el objeto Reordenamiento con todos sus related (equipo, labs, usuarios)
#    - Renderizar template HTML a PDF usando WeasyPrint:
#      Template: 'reordenamiento/reporte_pdf.html'
#      Datos: equipo, origen, destino, cantidad, resolución, fecha, autorizador
#    - Subir el PDF generado a S3/MinIO en bucket 'reportes/reordenamientos/'
#      Nombre del archivo: f"reordenamiento_{reordenamiento_id}_{timestamp}.pdf"
#    - Actualizar campo pdf_reporte_url en el modelo Reordenamiento
#    - Si falla: reintentar hasta 3 veces con backoff exponencial (autoretry_for)
#    - Registrar en AuditLog que el PDF fue generado
#
# 2. @shared_task recalcular_metricas_laboratorio(laboratorio_id):
#    - Llamar InventoryAnalyticsService.calcular_deficit_laboratorio(laboratorio_id)
#    - Llamar InventoryAnalyticsService.detectar_excedentes(laboratorio_id)
#    - Guardar resultados en caché Redis con TTL=3600
#    - Esta tarea se programa nocturnamente desde Celery Beat
#
# Incluir manejo de excepciones con logging detallado
