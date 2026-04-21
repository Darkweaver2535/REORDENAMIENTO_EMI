import urllib.request
import json

ENDPOINTS = [
    ("POST", "/api/v1/auth/login/"),
    ("POST", "/api/v1/auth/refresh/"),
    ("GET", "/api/v1/estructura_academica/unidades-academicas/"),
    ("GET", "/api/v1/estructura_academica/departamentos/"),
    ("GET", "/api/v1/estructura_academica/departamentos/?unidad_academica_id=1"),
    ("GET", "/api/v1/estructura_academica/carreras/"),
    ("GET", "/api/v1/estructura_academica/carreras/?departamento_id=1"),
    ("GET", "/api/v1/estructura_academica/semestres/"),
    ("GET", "/api/v1/estructura_academica/asignaturas/?carrera_id=1"),
    ("GET", "/api/v1/guias/"),
    ("GET", "/api/v1/guias/?asignatura_id=1"),
    ("POST", "/api/v1/guias/"),
    ("PATCH", "/api/v1/guias/1/"),
    ("PATCH", "/api/v1/guias/1/cambiar-estado/"),
    ("GET", "/api/v1/laboratorios/"),
    ("GET", "/api/v1/laboratorios/1/"),
    ("GET", "/api/v1/laboratorios/equipos/?laboratorio_id=1"),
    ("PATCH", "/api/v1/laboratorios/equipos/1/evaluacion-insitu/"),
    ("GET", "/api/v1/reordenamientos/"),
    ("POST", "/api/v1/reordenamientos/"),
    ("POST", "/api/v1/reordenamientos/1/autorizar/"),
    ("POST", "/api/v1/reordenamientos/1/ejecutar/"),
    ("GET", "/api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=Balanza"),
    ("GET", "/api/v1/dashboard/metricas/"),
    ("GET", "/api/v1/notificaciones/"),
    ("GET", "/api/v1/notificaciones/?leida=false"),
    ("POST", "/api/v1/notificaciones/1/marcar-leida/"),
    ("POST", "/api/v1/notificaciones/marcar-todas-leidas/"),
    ("GET", "/api/v1/reportes/inventario-laboratorio/1/"),
    ("GET", "/api/v1/reportes/reordenamientos/?fecha_inicio=2026-01-01&fecha_fin=2026-04-30"),
    ("GET", "/api/v1/reportes/comparativa-sedes/"),
    ("GET", "/api/v1/usuarios/"),
    ("PATCH", "/api/v1/usuarios/1/"),
    ("GET", "/api/v1/configuracion/"),
    ("PATCH", "/api/v1/configuracion/"),
]

BASE_URL = "http://127.0.0.1:8000"

results = []

for method, path in ENDPOINTS:
    url = BASE_URL + path
    req = urllib.request.Request(url, method=method)
    if method in ("POST", "PATCH"):
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps({}).encode("utf-8")
    
    try:
        response = urllib.request.urlopen(req)
        status = response.status
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception as e:
        status = str(e)
    
    # 404 and 301 is fail, anything else (200, 400, 401, 403, 405) means the route exists but might need auth/correct data
    if isinstance(status, int) and status not in (404, 301, 500):
        results.append(f"✅ {method} {path} (Status: {status})")
    elif status == 500:
        results.append(f"❌ {method} {path} (Status: 500 Server Error)")
    elif status == 301:
        # Check if it wants a slash
        results.append(f"❌ {method} {path} (Status: 301 Redirect - probably missing slash or incorrect path)")
    else:
        results.append(f"❌ {method} {path} (Status: {status})")

for res in results:
    print(res)

