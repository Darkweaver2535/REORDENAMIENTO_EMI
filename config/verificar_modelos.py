"""Script de verificacion de modelos - Fase 1.

Ejecucion recomendada desde la raiz del proyecto:
	./venv/bin/python manage.py shell < config/verificar_modelos.py
"""

from importlib import import_module


errores = 0
modelos_ok = 0


def ok(msg):
	print(f"✅ OK: {msg}")


def fail(msg):
	global errores
	errores += 1
	print(f"❌ FALTA: {msg}")


print("===== 1) IMPORTACION DE MODELOS =====")

# Compatibilidad con imports solicitados (sin prefijo apps) y estructura actual (apps.*).
IMPORT_CANDIDATOS = {
	"usuarios.models": "apps.usuarios.models",
	"estructura_academica.models": "apps.estructura_academica.models",
	"guias.models": "apps.guias.models",
	"laboratorios.models": "apps.laboratorios.models",
	"reordenamiento.models": "apps.reordenamiento.models",
}

modulos = {}
for nombre_solicitado, nombre_real in IMPORT_CANDIDATOS.items():
	modulo = None
	ultimo_error = None
	for candidato in (nombre_solicitado, nombre_real):
		try:
			modulo = import_module(candidato)
			modulos[nombre_solicitado] = modulo
			if candidato == nombre_solicitado:
				ok(f"IMPORT: {nombre_solicitado}")
			else:
				ok(f"IMPORT: {nombre_solicitado} (resuelto como {candidato})")
			break
		except Exception as exc:  # pragma: no cover - script operativo
			ultimo_error = exc

	if modulo is None:
		errores += 1
		print(f"❌ ERROR IMPORT: {nombre_solicitado}")
		print(f"   Detalle: {ultimo_error}")


def get_model(module_key, model_name):
	global modelos_ok, errores
	try:
		modelo = getattr(modulos[module_key], model_name)
		modelos_ok += 1
		ok(f"MODELO: {model_name}")
		return modelo
	except Exception as exc:  # pragma: no cover - script operativo
		errores += 1
		print(f"❌ ERROR IMPORT: {model_name}")
		print(f"   Detalle: {exc}")
		return None


Usuario = get_model("usuarios.models", "Usuario")
AuditLog = get_model("usuarios.models", "AuditLog")
UnidadAcademica = get_model("estructura_academica.models", "UnidadAcademica")
Departamento = get_model("estructura_academica.models", "Departamento")
Carrera = get_model("estructura_academica.models", "Carrera")
CarreraUnidadAcademica = get_model("estructura_academica.models", "CarreraUnidadAcademica")
Semestre = get_model("estructura_academica.models", "Semestre")
Asignatura = get_model("estructura_academica.models", "Asignatura")
Guia = get_model("guias.models", "Guia")
Laboratorio = get_model("laboratorios.models", "Laboratorio")
Equipo = get_model("laboratorios.models", "Equipo")
EquipoRequeridoPorGuia = get_model("laboratorios.models", "EquipoRequeridoPorGuia")
Reordenamiento = get_model("reordenamiento.models", "Reordenamiento")


print("\n===== 2) VERIFICACION DE CAMPOS CRITICOS =====")


def check_attr(obj, attr_name, etiqueta):
	if obj is None:
		fail(f"{etiqueta} (modelo no importado)")
		return
	if hasattr(obj, attr_name):
		ok(etiqueta)
	else:
		fail(etiqueta)


check_attr(Usuario, "carnet_identidad", "Usuario.carnet_identidad")
check_attr(Usuario, "rol", "Usuario.rol")
check_attr(Usuario, "unidad_academica", "Usuario.unidad_academica")

check_attr(Asignatura, "codigo_curricular", "Asignatura.codigo_curricular")

check_attr(Equipo, "cantidad_buena", "Equipo.cantidad_buena")
check_attr(Equipo, "cantidad_regular", "Equipo.cantidad_regular")
check_attr(Equipo, "cantidad_mala", "Equipo.cantidad_mala")
check_attr(Equipo, "cantidad_disponible", "Equipo.cantidad_disponible()")

check_attr(Guia, "estado", "Guia.estado")
check_attr(Guia, "resolucion_numero", "Guia.resolucion_numero")
check_attr(Guia, "pdf_url", "Guia.pdf_url")
check_attr(Guia, "portada_url", "Guia.portada_url")
check_attr(Guia, "puede_publicarse", "Guia.puede_publicarse()")

check_attr(Reordenamiento, "resolucion_numero", "Reordenamiento.resolucion_numero")
check_attr(Reordenamiento, "laboratorio_origen", "Reordenamiento.laboratorio_origen")
check_attr(Reordenamiento, "laboratorio_destino", "Reordenamiento.laboratorio_destino")


print("\n===== 3) PRUEBAS EN MEMORIA =====")

if Equipo is not None:
	try:
		equipo_demo = Equipo(cantidad_buena=5, cantidad_regular=3, cantidad_mala=2)
		resultado = equipo_demo.cantidad_disponible()
		if resultado == 8:
			print(f"✅ cantidad_disponible() = {resultado} (esperado: 8)")
		else:
			errores += 1
			print(f"❌ cantidad_disponible() = {resultado} (esperado: 8)")
	except Exception as exc:  # pragma: no cover - script operativo
		errores += 1
		print(f"❌ ERROR prueba cantidad_disponible(): {exc}")
else:
	errores += 1
	print("❌ ERROR prueba cantidad_disponible(): modelo Equipo no disponible")

if Guia is not None:
	try:
		guia_borrador = Guia(estado="borrador", resolucion_numero=None, pdf_url="https://ejemplo.com/guia.pdf")
		r1 = guia_borrador.puede_publicarse()
		if r1 is False:
			print(f"✅ puede_publicarse() con borrador+sin_resolución = {r1} (esperado: False)")
		else:
			errores += 1
			print(f"❌ puede_publicarse() con borrador+sin_resolución = {r1} (esperado: False)")

		guia_aprobada = Guia(
			estado="aprobado",
			resolucion_numero="RES-2025-001",
			pdf_url="https://ejemplo.com/guia.pdf",
		)
		r2 = guia_aprobada.puede_publicarse()
		if r2 is True:
			print(f"✅ puede_publicarse() con aprobado+con_resolución = {r2} (esperado: True)")
		else:
			errores += 1
			print(f"❌ puede_publicarse() con aprobado+con_resolución = {r2} (esperado: True)")
	except Exception as exc:  # pragma: no cover - script operativo
		errores += 1
		print(f"❌ ERROR pruebas Guia.puede_publicarse(): {exc}")
else:
	errores += 1
	print("❌ ERROR pruebas Guia.puede_publicarse(): modelo Guia no disponible")


print("\n===== 4) VERIFICACION DE CHOICES =====")


def print_choices(etiqueta, choices_obj):
	valores = [valor for valor, _ in choices_obj]
	print(f"{etiqueta}: {valores}")
	return valores


if Usuario is not None:
	roles = print_choices("Roles Usuario", Usuario.Rol.choices)
	esperados_roles = [
		"ESTUDIANTE",
		"DOCENTE",
		"ADMIN",
		"JEFE",
		"DECANO",
		"ENCARGADO_ACTIVOS",
	]
	if all(r in roles for r in esperados_roles):
		ok("Choices de Usuario (roles)")
	else:
		fail("Choices de Usuario (roles)")

if Guia is not None:
	estados_guia = print_choices("Estados Guia", Guia.Estado.choices)
	esperados_guia = ["borrador", "pendiente", "aprobado", "publicado"]
	if all(e in estados_guia for e in esperados_guia):
		ok("Choices de Guia (estado)")
	else:
		fail("Choices de Guia (estado)")

if Reordenamiento is not None:
	estados_reord = print_choices("Estados Reordenamiento", Reordenamiento.Estado.choices)
	esperados_reord = ["pendiente", "autorizado", "ejecutado", "cancelado"]
	if all(e in estados_reord for e in esperados_reord):
		ok("Choices de Reordenamiento (estado)")
	else:
		fail("Choices de Reordenamiento (estado)")


print("\n===== RESUMEN DE VERIFICACIÓN FASE 1 =====")
print(f"✅ Modelos verificados: {modelos_ok}")
print(f"❌ Errores encontrados: {errores}")
print(f"Listo para continuar con Fase 2: {'SI' if errores == 0 else 'NO'}")