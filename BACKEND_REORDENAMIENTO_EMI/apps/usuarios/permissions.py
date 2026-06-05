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

# ── Helpers de negocio: reordenamientos ──────────────────────────────────────

def can_approve_reordenamiento(user):
	"""Devuelve True si el usuario puede aprobar reordenamientos.

	Actualmente mapeado a admin|jefe (rol DNCIT aún no existe en el sistema).
	Cuando se cree el rol DNCIT, actualizar este helper exclusivamente
	sin tocar ninguna otra lógica. Ej:
		return _rol_usuario(user) in {"admin", "jefe", "dncit"}
	"""
	return _rol_usuario(user) in ROL_ADMIN


def notify_activos_fijos(reordenamiento, evento="aprobado"):
	"""Envía notificación pasiva a todos los usuarios con rol encargado_activos.

	Activos Fijos NO aprueba; solo es notificado para actualizar inventario.
	eventos esperados: 'aprobado', 'recepcionado'
	"""
	try:
		from apps.notificaciones.models import Notificacion
		from apps.usuarios.models import Usuario

		# FIX #5: el rol se guarda en MAYÚSCULAS ('ENCARGADO_ACTIVOS') igual que los
		# choices del modelo. El filtro anterior usaba "encargado_activos" en
		# minúsculas y nunca encontraba a nadie → las notificaciones no llegaban.
		# Usamos la constante del enum para evitar errores de casing.
		encargados = Usuario.objects.filter(rol=Usuario.Rol.ENCARGADO_ACTIVOS)
		tipo_movimiento = reordenamiento.get_tipo_movimiento_display()
		equipo_nombre = reordenamiento.equipo.nombre if reordenamiento.equipo_id else "—"
		if evento == "aprobado":
			mensaje = (
				f"{tipo_movimiento} #{reordenamiento.id} aprobado. "
				f"Equipo: {equipo_nombre}. Actualiza el inventario cuando corresponda."
			)
		else:
			mensaje = (
				f"{tipo_movimiento} #{reordenamiento.id} recepcionado. "
				f"Equipo: {equipo_nombre}. Confirma el inventario en destino."
			)

		for enc in encargados:
			Notificacion.objects.create(
				usuario=enc,
				tipo=Notificacion.Tipo.AUTORIZACION,
				mensaje=mensaje,
				objeto_id=reordenamiento.id,
				objeto_url=f"/reordenamientos/{reordenamiento.id}",
			)
	except Exception:
		# Nunca bloquear el flujo principal por un error de notificación
		pass


# ── Convención de roles (#18) ────────────────────────────────────────────────
# El rol se ALMACENA en MAYÚSCULAS (ver Usuario.Rol: 'ADMIN', 'JEFE',
# 'ENCARGADO_ACTIVOS', etc.). Para comparar SIEMPRE se normaliza con
# _rol_usuario() (lower) y se contrasta contra las constantes en minúsculas de
# abajo. Para FILTRAR en la BD úsense las constantes del enum Usuario.Rol (no
# strings sueltos), porque la query no normaliza el casing.
ROL_ENCARGADO = "encargado_activos"


def _rol_usuario(user):
	"""Rol normalizado a minúsculas para comparaciones robustas (no para queries)."""
	return (getattr(user, "rol", "") or "").strip().lower()


def _es_admin_o_jefe(user):
	return _rol_usuario(user) in ROL_ADMIN


# ── Helpers públicos de rol (reutilizables en views) ─────────────────────────
def es_admin_o_jefe(user):
	"""True si el usuario tiene visibilidad nacional (ADMIN o JEFE)."""
	return bool(user and user.is_authenticated and _es_admin_o_jefe(user))


def es_encargado_activos(user):
	"""True si el usuario es ENCARGADO_ACTIVOS (visibilidad acotada a su sede)."""
	return bool(user and user.is_authenticated and _rol_usuario(user) == ROL_ENCARGADO)


def scope_inventario_por_rol(queryset, user, campo_unidad="unidad_academica_id"):
	"""Aplica la regla de visibilidad de inventario (#15) a un queryset.

	- ADMIN / JEFE   → ven todo (visión nacional, necesaria para comparativas
	                   y reordenamientos entre sedes).
	- ENCARGADO_ACTIVOS → solo su unidad académica; sin unidad asignada, nada.
	- Resto (ESTUDIANTE/DOCENTE/anónimo) → queryset vacío.

	`campo_unidad` es el lookup para filtrar por unidad en ese modelo
	(ej. 'unidad_academica_id' o 'laboratorio__unidad_academica_id').
	"""
	if es_admin_o_jefe(user):
		return queryset
	if es_encargado_activos(user):
		unidad_id = getattr(user, "unidad_academica_id", None)
		if unidad_id:
			return queryset.filter(**{campo_unidad: unidad_id})
		return queryset.none()
	return queryset.none()


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


class EsDNCIT(BasePermission):
	"""Permite acceso a quienes pueden aprobar reordenamientos.

	Actualmente equivale a EsAdminOJefe. Cuando exista el rol DNCIT,
	actualizar can_approve_reordenamiento() en este mismo archivo.
	"""
	message = "Acceso restringido a DNCIT o ADMIN/JEFE para aprobar reordenamientos."
	code = "requiere_dncit"

	def has_permission(self, request, view):
		user = request.user
		return bool(user and user.is_authenticated and can_approve_reordenamiento(user))
