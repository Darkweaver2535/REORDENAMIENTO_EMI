# Sistema de gestión de laboratorios universitarios
# TAREA: Crear script de verificación para Fases 2, 3 y 4.
# Ejecutar con: python manage.py shell < verificar_fases2_4.py
#
# VERIFICAR LO SIGUIENTE:
#
# ===== FASE 2: ADMIN =====
# 1. Verificar que cada modelo está registrado en el admin:
#    from django.contrib import admin
#    Comprobar con admin.site._registry que existan las clases:
#    Usuario, AuditLog, UnidadAcademica, Departamento, Carrera,
#    Semestre, Asignatura, Guia, Laboratorio, Equipo,
#    EquipoRequeridoPorGuia, Reordenamiento
#    Imprimir "✅ ADMIN: {modelo}" o "❌ NO REGISTRADO: {modelo}"
#
# ===== FASE 3: PERMISOS Y AUTH =====
# 2. Verificar que existen las clases de permisos:
#    from usuarios.permissions import (EsSoloLectura, EsAdminOJefe,
#    EsEncargadoActivos, EsDecanoOAdmin, PuedeGestionarGuias, PuedeVerGuias)
#    Imprimir "✅ PERMISO: {clase}" o "❌ FALTA PERMISO: {clase}"
#
# 3. Verificar que existe SAGAAuthBackend:
#    from usuarios.backends import SAGAAuthBackend
#    Instanciar y verificar que tiene método 'authenticate' y 'get_user'
#    Imprimir resultado
#
# 4. Verificar que el Usuario superusuario tiene carnet_identidad como username:
#    from django.contrib.auth import get_user_model
#    User = get_user_model()
#    Verificar User.USERNAME_FIELD == 'carnet_identidad'
#    Imprimir "✅ USERNAME_FIELD = {valor}" o "❌ USERNAME_FIELD incorrecto"
#
# ===== FASE 4: SERIALIZERS =====
# 5. Importar todos los serializers y verificar que instancian sin error:
#    from estructura_academica.serializers import (UnidadAcademicaSerializer,
#    DepartamentoSerializer, CarreraSerializer, SemestreSerializer,
#    AsignaturaSerializer)
#    from guias.serializers import (GuiaListSerializer, GuiaDetalleSerializer,
#    GuiaCrearSerializer, GuiaEstadoSerializer)
#    Imprimir "✅ SERIALIZER: {nombre}" para cada uno
#
# 6. Verificar que GuiaListSerializer tiene el campo 'estado' en sus fields
#    Verificar que GuiaCrearSerializer tiene validación para evitar
#    duplicados (asignatura, numero_practica)
#    Verificar que GuiaEstadoSerializer valida resolucion_numero al publicar
#    Imprimir resultado de cada verificación
#
# 7. Hacer una prueba de serialización en memoria:
#    Crear una instancia de UnidadAcademica sin guardar:
#    ua = UnidadAcademica(nombre='La Paz', ciudad='La Paz', codigo='LPZ')
#    Serializar con UnidadAcademicaSerializer(ua)
#    Verificar que .data retorna dict con claves: id, nombre, ciudad, codigo
#    Imprimir "✅ Serialización OK: {data}" o "❌ Error: {error}"
#
# ===== RESUMEN =====
# Imprimir al final:
# "===== RESUMEN FASES 2-4 ====="
# "✅ Verificados correctamente: {N}"
# "❌ Errores encontrados: {N}"
# "Listo para Fase 5 (services.py): {SI/NO}"

"""Script de verificacion Fases 2, 3 y 4.

Ejecucion:
	./venv/bin/python manage.py shell < verificar_fases2_4.py
"""

from importlib import import_module
import inspect

from django.contrib import admin
from django.contrib.auth import get_user_model


ok_count = 0
error_count = 0


def ok(msg):
	global ok_count
	ok_count += 1
	print(f"✅ {msg}")


def fail(msg, detail=None):
	global error_count
	error_count += 1
	print(f"❌ {msg}")
	if detail:
		print(f"   Detalle: {detail}")


def import_with_fallback(short_path, apps_path):
	for path in (short_path, apps_path):
		try:
			return import_module(path), path
		except Exception:
			continue
	raise ImportError(f"No se pudo importar {short_path} ni {apps_path}")


print("===== FASE 2: ADMIN =====")

# Asegura autodiscovery de admin de todas las apps instaladas.
admin.autodiscover()

usuarios_models, _ = import_with_fallback("usuarios.models", "apps.usuarios.models")
estructura_models, _ = import_with_fallback("estructura_academica.models", "apps.estructura_academica.models")
guias_models, _ = import_with_fallback("guias.models", "apps.guias.models")
laboratorios_models, _ = import_with_fallback("laboratorios.models", "apps.laboratorios.models")
reordenamiento_models, _ = import_with_fallback("reordenamiento.models", "apps.reordenamiento.models")

modelos_admin = [
	usuarios_models.Usuario,
	usuarios_models.AuditLog,
	estructura_models.UnidadAcademica,
	estructura_models.Departamento,
	estructura_models.Carrera,
	estructura_models.Semestre,
	estructura_models.Asignatura,
	guias_models.Guia,
	laboratorios_models.Laboratorio,
	laboratorios_models.Equipo,
	laboratorios_models.EquipoRequeridoPorGuia,
	reordenamiento_models.Reordenamiento,
]

for modelo in modelos_admin:
	if modelo in admin.site._registry:
		ok(f"ADMIN: {modelo.__name__}")
	else:
		fail(f"NO REGISTRADO: {modelo.__name__}")


print("\n===== FASE 3: PERMISOS Y AUTH =====")

try:
	permissions_module, resolved = import_with_fallback(
		"usuarios.permissions", "apps.usuarios.permissions"
	)
	ok(f"IMPORT permisos ({resolved})")
except Exception as exc:
	permissions_module = None
	fail("ERROR IMPORT permisos", str(exc))

for nombre_permiso in [
	"EsSoloLectura",
	"EsAdminOJefe",
	"EsEncargadoActivos",
	"EsDecanoOAdmin",
	"PuedeGestionarGuias",
	"PuedeVerGuias",
]:
	if permissions_module and hasattr(permissions_module, nombre_permiso):
		ok(f"PERMISO: {nombre_permiso}")
	else:
		fail(f"FALTA PERMISO: {nombre_permiso}")

try:
	backends_module, resolved = import_with_fallback(
		"usuarios.backends", "apps.usuarios.backends"
	)
	SAGAAuthBackend = getattr(backends_module, "SAGAAuthBackend")
	backend = SAGAAuthBackend()
	if hasattr(backend, "authenticate") and hasattr(backend, "get_user"):
		ok(f"SAGAAuthBackend OK ({resolved})")
	else:
		fail("SAGAAuthBackend incompleto", "Falta authenticate o get_user")
except Exception as exc:
	fail("ERROR SAGAAuthBackend", str(exc))

User = get_user_model()
if User.USERNAME_FIELD == "carnet_identidad":
	ok(f"USERNAME_FIELD = {User.USERNAME_FIELD}")
else:
	fail("USERNAME_FIELD incorrecto", f"Valor actual: {User.USERNAME_FIELD}")


print("\n===== FASE 4: SERIALIZERS =====")

try:
	ea_serializers_module, resolved_ea = import_with_fallback(
		"estructura_academica.serializers", "apps.estructura_academica.serializers"
	)
	guias_serializers_module, resolved_guias = import_with_fallback(
		"guias.serializers", "apps.guias.serializers"
	)
	ok(f"IMPORT serializers estructura_academica ({resolved_ea})")
	ok(f"IMPORT serializers guias ({resolved_guias})")
except Exception as exc:
	ea_serializers_module = None
	guias_serializers_module = None
	fail("ERROR IMPORT serializers", str(exc))

serializers_nombres = [
	"UnidadAcademicaSerializer",
	"DepartamentoSerializer",
	"CarreraSerializer",
	"SemestreSerializer",
	"AsignaturaSerializer",
]

if ea_serializers_module:
	for nombre in serializers_nombres:
		cls = getattr(ea_serializers_module, nombre, None)
		if cls is None:
			fail(f"FALTA SERIALIZER: {nombre}")
			continue
		try:
			cls()
			ok(f"SERIALIZER: {nombre}")
		except Exception as exc:
			fail(f"ERROR SERIALIZER: {nombre}", str(exc))

serializers_guias_nombres = [
	"GuiaListSerializer",
	"GuiaDetalleSerializer",
	"GuiaCrearSerializer",
	"GuiaEstadoSerializer",
]

if guias_serializers_module:
	for nombre in serializers_guias_nombres:
		cls = getattr(guias_serializers_module, nombre, None)
		if cls is None:
			fail(f"FALTA SERIALIZER: {nombre}")
			continue
		try:
			cls()
			ok(f"SERIALIZER: {nombre}")
		except Exception as exc:
			fail(f"ERROR SERIALIZER: {nombre}", str(exc))

	GuiaListSerializer = getattr(guias_serializers_module, "GuiaListSerializer", None)
	GuiaCrearSerializer = getattr(guias_serializers_module, "GuiaCrearSerializer", None)
	GuiaEstadoSerializer = getattr(guias_serializers_module, "GuiaEstadoSerializer", None)

	if GuiaListSerializer:
		list_fields = list(GuiaListSerializer().get_fields().keys())
		if "estado" in list_fields:
			ok("GuiaListSerializer incluye campo 'estado'")
		else:
			fail("GuiaListSerializer no incluye campo 'estado'")

	if GuiaCrearSerializer:
		try:
			src = inspect.getsource(GuiaCrearSerializer.validate)
			if "asignatura" in src and "numero_practica" in src and "exists" in src:
				ok("GuiaCrearSerializer valida duplicados (asignatura, numero_practica)")
			else:
				fail("GuiaCrearSerializer sin validacion clara de duplicados")
		except Exception as exc:
			fail("No se pudo inspeccionar validate() de GuiaCrearSerializer", str(exc))

	if GuiaEstadoSerializer:
		try:
			src = inspect.getsource(GuiaEstadoSerializer.validate)
			tiene_publicado = ("publicado" in src) or ("PUBLICADO" in src)
			if tiene_publicado and "resolucion_numero" in src:
				ok("GuiaEstadoSerializer valida resolucion_numero al publicar")
			else:
				fail("GuiaEstadoSerializer sin validacion clara al publicar")
		except Exception as exc:
			fail("No se pudo inspeccionar validate() de GuiaEstadoSerializer", str(exc))


try:
	UnidadAcademicaSerializer = getattr(ea_serializers_module, "UnidadAcademicaSerializer")
	UnidadAcademica = estructura_models.UnidadAcademica
	ua = UnidadAcademica(nombre="La Paz", ciudad="La Paz", codigo="LPZ")
	data = UnidadAcademicaSerializer(ua).data
	claves_esperadas = {"id", "nombre", "ciudad", "codigo"}
	if claves_esperadas.issubset(set(data.keys())):
		ok(f"Serializacion OK: {data}")
	else:
		fail("Serializacion incompleta", f"Claves recibidas: {list(data.keys())}")
except Exception as exc:
	fail("Error en prueba de serializacion", str(exc))


print("\n===== RESUMEN FASES 2-4 =====")
print(f"✅ Verificados correctamente: {ok_count}")
print(f"❌ Errores encontrados: {error_count}")
print(f"Listo para Fase 5 (services.py): {'SI' if error_count == 0 else 'NO'}")