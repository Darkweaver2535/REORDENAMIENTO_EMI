# App: guias | Archivo: views.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear GuiaViewSet con control de acceso estricto por rol y estado:
#
# class GuiaViewSet(ModelViewSet):
#
# 1. get_queryset():
#    - Si usuario.rol in ['estudiante', 'docente']:
#      SOLO retornar guías con estado='publicado'
#    - Si usuario.rol in ['admin', 'jefe', 'decano']:
#      Retornar TODAS las guías (todos los estados)
#    - Siempre filtrar por asignatura_id si viene en query_params
#    - Usar select_related('asignatura', 'aprobado_por')
#
# 2. get_permissions():
#    - list, retrieve: IsAuthenticated (todos pueden ver lo publicado)
#    - create, update, partial_update: PuedeGestionarGuias (solo admin/jefe)
#    - destroy: EsAdminOJefe
#
# 3. get_serializer_class():
#    - Para list: GuiaListSerializer
#    - Para retrieve: GuiaDetalleSerializer
#    - Para create/update: GuiaCrearSerializer
#
# 4. @action(detail=True, methods=['post'], url_path='solicitar-aprobacion')
#    solicitar_aprobacion(request, pk): cambia estado a 'pendiente'
#    Requiere: PuedeGestionarGuias
#
# 5. @action(detail=True, methods=['post'], url_path='publicar')
#    publicar(request, pk): cambia estado a 'publicado', requiere resolucion_numero
#    Requiere: EsDecanoOAdmin
#    Valida: guia.puede_publicarse() == True
#    Registra en AuditLog accion='PUBLISH'
#
# 6. @action(detail=True, methods=['post'], url_path='rechazar')
#    rechazar(request, pk): regresa a 'borrador', guarda motivo_rechazo
#    Requiere: EsDecanoOAdmin

from django.shortcuts import render

# Create your views here.
