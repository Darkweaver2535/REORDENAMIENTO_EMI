# App: usuarios | Archivo: permissions.py
# Sistema de gestión de laboratorios universitarios - Django REST Framework
#
# Clases de permisos personalizadas que heredan de BasePermission:
#
# 1. EsSoloLectura: permite solo métodos GET, HEAD, OPTIONS
#
# 2. EsAdminOJefe: permite acceso si rol in ['admin', 'jefe']
#
# 3. EsEncargadoActivos: permite acceso si rol == 'encargado_activos' OR EsAdminOJefe
#
# 4. PuedeGestionarGuias: permite crear/editar guías si rol in ['admin', 'jefe']
#
# 5. PuedeVerGuias: permite GET si la guía tiene estado='publicado'
#   O si el usuario tiene rol admin/jefe (ellos ven todos los estados)
#
# Para cada clase incluir mensaje de error descriptivo en message y code

from rest_framework.permissions import SAFE_METHODS, BasePermission


ROL_ADMIN = {"admin", "jefe"}


def _rol_usuario(user):
	return (getattr(user, "rol", "") or "").strip().lower()


def _es_admin_o_jefe(user):
	return _rol_usuario(user) in ROL_ADMIN


class EsSoloLectura(BasePermission):
	message = "Solo se permiten operaciones de lectura (GET, HEAD, OPTIONS)."
	code = "solo_lectura"

	def has_permission(self, request, view):
		return request.method in SAFE_METHODS


class EsAdminOJefe(BasePermission):
	message = "Acceso restringido a usuarios con rol ADMIN o JEFE."
	code = "requiere_admin_o_jefe"

	def has_permission(self, request, view):
		user = request.user
		return bool(user and user.is_authenticated and _es_admin_o_jefe(user))


class EsEncargadoActivos(BasePermission):
	message = "Acceso restringido a ENCARGADO_ACTIVOS o perfiles ADMIN/JEFE."
	code = "requiere_encargado_activos"

	def has_permission(self, request, view):
		user = request.user
		if not (user and user.is_authenticated):
			return False
		rol = _rol_usuario(user)
		return rol == "encargado_activos" or rol in ROL_ADMIN


class PuedeGestionarGuias(BasePermission):
	message = "Solo ADMIN y JEFE pueden crear o editar guias."
	code = "no_puede_gestionar_guias"

	def has_permission(self, request, view):
		user = request.user
		if not (user and user.is_authenticated):
			return False

		rol = _rol_usuario(user)
		if request.method in SAFE_METHODS:
			return True

		return rol in {"admin", "jefe"}


class PuedeVerGuias(BasePermission):
	message = "Solo se pueden ver guias publicadas, salvo roles ADMIN/JEFE."
	code = "guia_no_visible"

	def has_permission(self, request, view):
		user = request.user
		if not (user and user.is_authenticated):
			return False

		if request.method not in SAFE_METHODS:
			return False

		return True

	def has_object_permission(self, request, view, obj):
		if request.method not in SAFE_METHODS:
			return False

		if _es_admin_o_jefe(request.user):
			return True

		return getattr(obj, "estado", None) == "publicado"
