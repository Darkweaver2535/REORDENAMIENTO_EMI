# App: usuarios | Archivo: permissions.py
# Sistema de gestión de laboratorios universitarios - Django REST Framework
#
# TAREA: Crear clases de permisos personalizadas que hereden de BasePermission:
#
# 1. EsSoloLectura: permite solo métodos GET, HEAD, OPTIONS
#
# 2. EsAdminOJefe: permite acceso si rol in ['admin', 'jefe', 'decano']
#
# 3. EsEncargadoActivos: permite acceso si rol == 'encargado_activos' OR EsAdminOJefe
#
# 4. EsDecanoOAdmin: permite acceso si rol in ['decano', 'admin']
#   (para aprobar publicaciones de guías y autorizar reordenamientos)
#
# 5. PuedeGestionarGuias: permite crear/editar guías si rol in ['admin', 'jefe']
#   pero NO 'docente' (los docentes no pueden subir guías)
#
# 6. PuedeVerGuias: permite GET si la guía tiene estado='publicado'
#   O si el usuario tiene rol admin/jefe/decano (ellos ven todos los estados)
#
# Para cada clase incluir mensaje de error descriptivo en message y code

