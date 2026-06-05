"""
Importador de inventario físico del Trópico (UAT)
Archivo fuente: LABORATORIO DE LA EMI UAT.xlsx

Decisiones de diseño aplicadas:
  - Crear 3 nodos hoja: FÍSICA GENERAL, QUÍMICA GENERAL, CIVIL GENERAL
  - Importar 98 activos (excluir fila 106 = totalizador)
  - Mobiliario se importa con notas="MOBILIARIO"
  - ESTADO REGULAR → regular | MALO → malo
  - cantidad_total = 1 por fila (activo individual)
  - BA¥O → BAÑO (limpieza de carácter corrupto)
  - Vida útil, grupo contable, auxiliar, responsable → especificaciones (JSONField)

Uso:
  cd /Users/alvaroencinas/Desktop/REORDENAMIENTO_EMI
  source BACKEND_REORDENAMIENTO_EMI/venv/bin/activate
  python import_uat.py [--dry-run]

  --dry-run  Valida sin insertar nada en la BD.
"""
import os
import sys
import django
import argparse
import openpyxl

sys.path.append(os.path.abspath("BACKEND_REORDENAMIENTO_EMI"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import transaction
from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Laboratorio, Equipo

# ─── Configuración ────────────────────────────────────────────────────────────

EXCEL_PATH = "LABORATORIO DE LA EMI UAT.xlsx"
UA_CODIGO  = "0005"          # UAT - Trópico

# Mapeo: OFICINA del Excel → nombre del nodo hoja a crear/buscar
OFICINA_A_HOJA = {
    "LABORATORIO DE FISICA":      ("FÍSICA GENERAL",  61),   # padre: FÍSICA
    "LABORATORIO DE QUIMICA":     ("QUÍMICA GENERAL",  58),   # padre: QUÍMICA
    "LABORATORIO DE ING. CIVIL":  ("CIVIL GENERAL",    64),   # padre: CIVIL
}

# Tradución de ESTADO del Excel → estatus_general del modelo
ESTADO_MAP = {
    "REGULAR": Equipo.EstatusGeneral.REGULAR,
    "MALO":    Equipo.EstatusGeneral.MALO,
}

MOBILIARIO_KEYWORDS = {
    "SILLA", "ESCRITORIO", "ESTANTE", "ARMARIO", "PUPITRE", "MESA",
    "PIZARRA", "MUEBLE", "SILLON", "BUTACA", "VITRINA", "GABINETE",
    "TABLERO", "REPISA",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def limpiar_texto(valor):
    """Limpia whitespace y reemplaza caracteres corruptos."""
    if valor is None:
        return ""
    s = str(valor).strip()
    s = s.replace("¥", "Ñ")      # BA¥O → BAÑO
    return s


def es_mobiliario(descripcion, auxiliar):
    desc = descripcion.upper()
    aux  = auxiliar.upper()
    return any(k in desc for k in MOBILIARIO_KEYWORDS) or any(k in aux for k in MOBILIARIO_KEYWORDS)


def leer_excel():
    """Lee el Excel y retorna lista de dicts con los activos a importar."""
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb.active

    activos = []
    for row in ws.iter_rows(min_row=8, values_only=True):
        nro, codigo, descripcion, obs, estado, vida_util, grupo, auxiliar, oficina, responsable, cargo = (
            row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]
        )

        # Excluir fila totalizadora (CÓDIGO=CANTIDAD)
        if str(codigo or "").strip().upper() == "CANTIDAD":
            continue

        # Excluir filas completamente vacías
        if not any([codigo, descripcion, estado, oficina]):
            continue

        activos.append({
            "codigo":       limpiar_texto(codigo),
            "descripcion":  limpiar_texto(descripcion),
            "observaciones": limpiar_texto(obs),
            "estado":       limpiar_texto(estado).upper(),
            "vida_util":    vida_util,
            "grupo":        limpiar_texto(grupo),
            "auxiliar":     limpiar_texto(auxiliar),
            "oficina":      limpiar_texto(oficina).upper(),
            "responsable":  limpiar_texto(responsable),
            "cargo":        limpiar_texto(cargo),
        })

    return activos


def obtener_o_crear_hoja(nombre_hoja, padre_id, ua, dry_run):
    """Retorna el laboratorio hoja (o lo crea si no existe)."""
    padre = Laboratorio.objects.get(pk=padre_id)

    try:
        lab = Laboratorio.objects.get(nombre=nombre_hoja, parent=padre, unidad_academica=ua)
        print(f"  ✅ Nodo hoja EXISTENTE: '{nombre_hoja}' (ID={lab.id})")
        return lab
    except Laboratorio.DoesNotExist:
        if dry_run:
            print(f"  [DRY-RUN] Crearía nodo hoja: '{nombre_hoja}' bajo '{padre.nombre}' (ID={padre_id})")
            return None

        lab = Laboratorio(
            nombre=nombre_hoja,
            parent=padre,
            unidad_academica=ua,
            clase_nodo=Laboratorio.ClaseNodo.SUBESPACIO,
            subtipo_espacio=Laboratorio.SubtipoEspacio.LABORATORIO,
            campus=padre.campus or "UAT",
        )
        lab.full_clean()
        lab.save()
        print(f"  ✅ Nodo hoja CREADO: '{nombre_hoja}' (ID={lab.id})")
        return lab


# ─── Lógica principal ─────────────────────────────────────────────────────────

def run(dry_run=False):
    print("=" * 65)
    print(f"Importador UAT Trópico — {'DRY-RUN (sin escrituras)' if dry_run else 'MODO REAL'}")
    print("=" * 65)

    # 1. Obtener UA
    try:
        ua = UnidadAcademica.objects.get(codigo=UA_CODIGO)
        print(f"\n✅ Unidad Académica: {ua.nombre} (ID={ua.id})")
    except UnidadAcademica.DoesNotExist:
        print(f"\n❌ ERROR: No se encontró la UA con código '{UA_CODIGO}'. Abortando.")
        sys.exit(1)

    # 2. Leer activos del Excel
    activos = leer_excel()
    print(f"\n📋 Activos leídos del Excel: {len(activos)}")

    # 3. Validaciones previas
    codigos_excel = [a["codigo"] for a in activos]
    # Duplicados internos
    from collections import Counter
    dup = {c: n for c, n in Counter(codigos_excel).items() if n > 1}
    if dup:
        print(f"\n⚠️  ADVERTENCIA: Códigos duplicados en Excel: {dup}")

    # Colisiones con BD
    existentes = set(Equipo.objects.values_list("codigo_activo", flat=True))
    colisiones = set(codigos_excel) & existentes
    if colisiones:
        print(f"\n⚠️  ADVERTENCIA: Colisiones con BD (se saltarán): {colisiones}")
    else:
        print(f"✅ Sin colisiones de código activo con BD")

    # 4. Crear/verificar nodos hoja
    print("\n── Laboratorios hoja ──────────────────────────────────────")
    lab_map = {}  # "LABORATORIO DE FISICA" → objeto Laboratorio
    for oficina_excel, (nombre_hoja, padre_id) in OFICINA_A_HOJA.items():
        lab = obtener_o_crear_hoja(nombre_hoja, padre_id, ua, dry_run)
        lab_map[oficina_excel] = lab

    # 5. Importar activos
    print("\n── Importando activos ──────────────────────────────────────")
    ok = skip_colision = skip_error = 0
    errores = []

    for activo in activos:
        codigo  = activo["codigo"]
        oficina = activo["oficina"]

        # Saltar colisiones
        if codigo in colisiones:
            skip_colision += 1
            continue

        # Validar estado
        if activo["estado"] not in ESTADO_MAP:
            errores.append(f"  COD={codigo}: ESTADO desconocido '{activo['estado']}'")
            skip_error += 1
            continue

        # Obtener laboratorio hoja
        lab = lab_map.get(oficina)
        if lab is None:
            if dry_run:
                # en dry-run lab puede ser None, solo contar
                ok += 1
                continue
            errores.append(f"  COD={codigo}: OFICINA sin mapeo '{oficina}'")
            skip_error += 1
            continue

        estatus = ESTADO_MAP[activo["estado"]]
        if estatus == Equipo.EstatusGeneral.REGULAR:
            c_buena, c_regular, c_mala = 0, 1, 0
        else:  # MALO
            c_buena, c_regular, c_mala = 0, 0, 1

        mob = es_mobiliario(activo["descripcion"], activo["auxiliar"])
        notas_val = "MOBILIARIO" if mob else ""

        especificaciones = {}
        if activo["vida_util"] is not None:
            especificaciones["vida_util_anios"] = activo["vida_util"]
        if activo["grupo"]:
            especificaciones["grupo_contable"] = activo["grupo"]
        if activo["auxiliar"]:
            especificaciones["auxiliar"] = activo["auxiliar"]
        if activo["responsable"]:
            especificaciones["responsable"] = activo["responsable"]

        if dry_run:
            tag = "MOBILIARIO" if mob else "EQUIPO"
            print(f"  [DRY] {tag} | COD={codigo:<14} ESTADO={estatus:<8} LAB={lab.nombre if lab else '?'} | {activo['descripcion'][:50]}")
            ok += 1
            continue

        try:
            eq = Equipo(
                codigo_activo=codigo,
                nombre=activo["descripcion"],
                observaciones=activo["observaciones"],
                laboratorio=lab,
                cantidad_total=1,
                cantidad_buena=c_buena,
                cantidad_regular=c_regular,
                cantidad_mala=c_mala,
                estatus_general=estatus,
                especificaciones=especificaciones,
                notas=notas_val or None,
            )
            eq.full_clean()
            eq.save()
            ok += 1
            tag = "MOBILIARIO" if mob else "EQUIPO"
            print(f"  ✅ {tag} | {codigo:<14} | {activo['descripcion'][:50]}")
        except Exception as e:
            errores.append(f"  ❌ COD={codigo}: {e}")
            skip_error += 1

    # 6. Resumen
    print("\n" + "=" * 65)
    print("RESUMEN")
    print(f"  Importados correctamente : {ok}")
    print(f"  Saltados (colisión BD)   : {skip_colision}")
    print(f"  Saltados (error/mapeo)   : {skip_error}")
    if errores:
        print("\nErrores detallados:")
        for e in errores:
            print(e)
    print("=" * 65)

    if dry_run:
        print("\n⚠️  DRY-RUN: No se realizaron cambios en la BD.")
    else:
        print("\n✅ Importación completada.")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importador UAT Trópico")
    parser.add_argument("--dry-run", action="store_true", help="Valida sin escribir en BD")
    args = parser.parse_args()

    if args.dry_run:
        run(dry_run=True)
    else:
        with transaction.atomic():
            run(dry_run=False)
