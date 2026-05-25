"""
Management command: import_labs
================================
Importa laboratorios jerárquicos desde un Excel (.xlsx) de la EMI.

Lógica de parser (v3, carry-forward):
  - Auto-detecta la fila de cabecera buscando "NOMBRE DEL LABORATORIO"
  - Arrastra el último lab general no vacío como padre (lab_actual)
  - Arrastra el último tipo válido (tipo_actual) para filas hijo sin tipo explícito
  - Clasifica cada fila:
      CREATE_ROOT      → lab nuevo sin hijo en esta fila (fila de apertura)
      CREATE_CHILD     → subespacio nuevo creado
      UPDATE_CHILD     → subespacio existente con campos actualizados
      EXIST_ROOT       → lab general ya existía, sin cambios
      EXIST_CHILD      → subespacio ya existía, sin cambios
      SKIP_SUBJECT_ROW → fila solo con asignaturas/semestres (útil pero no estructural)
      SKIP_NORM_ROW    → fila de sub-cabecera PEA/INVESTIGACIÓN/norma
      AMBIGUOUS        → sec presente pero sin padre o tipo irreconocible

Función normalizar_texto():
  - Strip + collapse de espacios múltiples + eliminar saltos + uppercase para matching
  - Preserva el valor original (con tildes, mayúsculas/minúsculas) para mostrar en BD

Uso:
    python manage.py import_labs archivo.xlsx --unidad-academica CBBA
    python manage.py import_labs archivo.xlsx --unidad-academica 3
    python manage.py import_labs archivo.xlsx --unidad-academica CBBA --campus "Campus Central"
    python manage.py import_labs archivo.xlsx --unidad-academica CBBA --dry-run
    python manage.py import_labs archivo.xlsx --unidad-academica CBBA --dry-run --verbose

Dependencias:
    pip install openpyxl
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

try:
    import openpyxl
except ImportError:
    openpyxl = None


# ── Constantes de acción (para verbose logging) ───────────────────────────────
A_CREATE_ROOT      = "CREATE_ROOT"
A_CREATE_CHILD     = "CREATE_CHILD"
A_UPDATE_CHILD     = "UPDATE_CHILD"
A_EXIST_ROOT       = "EXIST_ROOT"
A_EXIST_CHILD      = "EXIST_CHILD"
A_SKIP_SUBJECT_ROW = "SKIP_SUBJECT_ROW"
A_SKIP_NORM_ROW    = "SKIP_NORM_ROW"
A_AMBIGUOUS        = "AMBIGUOUS"

# ── Subtipo canonical map ─────────────────────────────────────────────────────
TIPO_CANON = {
    "SALA":        "SALA",
    "AREA":        "AREA",
    "SECCION":     "SECCION",
    "LABORATORIO": "LABORATORIO",
}

SUBCAB_KEYWORDS = {"PEA", "INVESTIGACION", "VENTA DE SERVICIOS"}


# ── Funciones de normalización ────────────────────────────────────────────────

def normalizar_texto(valor: str) -> str:
    """
    Normaliza un texto para matching consistente:
      1. Convierte saltos de línea y nbsp a espacio
      2. Colapsa espacios múltiples a uno solo
      3. Strip de extremos
      4. Elimina tildes/diacríticos (NFD → solo ASCII base)
      5. Uppercase

    Retorna el string normalizado para usar como CLAVE de comparación.
    El valor ORIGINAL (con tildes y casing original) se conserva para guardar en BD.

    Ejemplos:
      "Química Básica"  → "QUIMICA BASICA"
      "SALA/ÁREA\\n"   → "SALA/AREA"
      "  Lab  I  "     → "LAB I"
    """
    if not valor:
        return ""
    # 1. Limpiar caracteres de control y nbsp
    s = valor.replace("\xa0", " ").replace("\n", " ").replace("\r", " ").replace("\t", " ")
    # 2. Colapsar espacios
    s = re.sub(r"\s+", " ", s).strip()
    # 3. Eliminar diacríticos (NFD → queda solo base ASCII)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    # 4. Uppercase
    return s.upper()


def limpiar_celda(valor) -> str:
    """Limpia una celda para mostrar: strip + colapso de saltos. Sin eliminar tildes."""
    if valor is None:
        return ""
    return re.sub(r"\s+", " ", str(valor).replace("\xa0", " ").replace("\n", " ")).strip()


def canon_tipo(raw: str) -> str | None:
    """Retorna subtipo canónico o None."""
    n = normalizar_texto(raw)
    if n in TIPO_CANON:
        return TIPO_CANON[n]
    # Prefijo (ej: "SALA " → "SALA")
    for k, v in TIPO_CANON.items():
        if n.startswith(k):
            return v
    return None


# ── Detección de esquema ──────────────────────────────────────────────────────

def detectar_schema(ws):
    """
    Busca la fila de cabecera (contiene 'NOMBRE DEL LABORATORIO') y mapea columnas.
    Retorna (cab_fila, col_nom, col_tipo, col_sec, col_sup, col_ubi, col_asig_start).
    """
    for i, row in enumerate(ws.iter_rows(max_row=15, values_only=True), start=1):
        for j, cell in enumerate(row):
            if cell and "NOMBRE DEL LABORATORIO" in normalizar_texto(str(cell)):
                col_nom = col_tipo = col_sec = col_sup = col_ubi = None
                col_asig_start = 999

                for k, c in enumerate(row):
                    nu = normalizar_texto(str(c)) if c else ""
                    if not nu:
                        continue
                    if "NOMBRE DEL LABORATORIO" in nu and col_nom is None:
                        col_nom = k
                    elif ("SALA" in nu or "AREA" in nu or "SECCION" in nu) and "SELECCIONE" in nu and col_tipo is None:
                        col_tipo = k
                    elif "NOMBRE DE LA" in nu and col_sec is None:
                        col_sec = k
                    elif "SUPERFICIE" in nu and col_sup is None:
                        col_sup = k
                    elif ("UBICACION" in nu or "UBICACION" in nu) and col_ubi is None:
                        col_ubi = k
                    elif any(kw in nu for kw in ("ASIGNATURA", "SEMESTRE", "CARRERA", "ACTIVIDAD", "NORMA")):
                        col_asig_start = min(col_asig_start, k)

                if col_asig_start == 999:
                    col_asig_start = (col_ubi or col_sup or col_sec or 5) + 1

                return i, col_nom, col_tipo, col_sec, col_sup, col_ubi, col_asig_start

    return None, None, None, None, None, None, None


def get_cell(row, col) -> str:
    if col is None or col >= len(row):
        return ""
    return limpiar_celda(row[col])


# ── Colores ANSI para la terminal ─────────────────────────────────────────────

_COLORS = {
    A_CREATE_ROOT:      "\033[92m",   # verde brillante
    A_CREATE_CHILD:     "\033[32m",   # verde
    A_UPDATE_CHILD:     "\033[33m",   # amarillo
    A_EXIST_ROOT:       "\033[90m",   # gris
    A_EXIST_CHILD:      "\033[90m",   # gris
    A_SKIP_SUBJECT_ROW: "\033[90m",   # gris
    A_SKIP_NORM_ROW:    "\033[90m",   # gris
    A_AMBIGUOUS:        "\033[91m",   # rojo
}
_RESET = "\033[0m"


def color_action(action: str) -> str:
    return f"{_COLORS.get(action, '')}{action:<17}{_RESET}"


# ── Management Command ────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Importa laboratorios jerárquicos desde un Excel (.xlsx) — parser v3"

    def add_arguments(self, parser):
        parser.add_argument(
            "archivo",
            type=str,
            help="Ruta al archivo Excel (.xlsx)",
        )
        parser.add_argument(
            "--unidad-academica",
            required=True,
            metavar="UA",
            help="ID numérico o nombre/código de la UnidadAcademica.",
        )
        parser.add_argument(
            "--campus",
            default="",
            metavar="CAMPUS",
            help="Campus por defecto para los nodos raíz.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula sin guardar nada en BD.",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Muestra una línea por fila procesada con su acción.",
        )

    def handle(self, *args, **options):
        if openpyxl is None:
            raise CommandError("openpyxl no instalado. Ejecuta: pip install openpyxl")

        from apps.laboratorios.models import Laboratorio
        from apps.estructura_academica.models import UnidadAcademica

        archivo  = options["archivo"]
        ua_ref   = options["unidad_academica"]
        campus   = options["campus"]
        dry_run  = options["dry_run"]
        verbose  = options["verbose"]

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "\n⚠  DRY-RUN activado — no se guardará nada en BD.\n"
            ))

        # ── Resolver UnidadAcademica
        unidad_academica = self._resolver_unidad(UnidadAcademica, ua_ref)
        self.stdout.write(f"📚 Unidad académica : {unidad_academica} (id={unidad_academica.id})\n")

        # ── Leer Excel
        try:
            wb = openpyxl.load_workbook(archivo, data_only=True)
        except FileNotFoundError:
            raise CommandError(f"Archivo no encontrado: {archivo}")
        except Exception as exc:
            raise CommandError(f"Error al abrir el Excel: {exc}")

        ws = wb.active
        self.stdout.write(f"📄 Archivo          : {archivo}")
        self.stdout.write(f"   Hoja            : {ws.title}  |  {ws.dimensions}\n")

        # ── Detectar esquema
        cab, c_nom, c_tipo, c_sec, c_sup, c_ubi, c_asig = detectar_schema(ws)
        if cab is None:
            raise CommandError(
                "No se encontró la cabecera ('NOMBRE DEL LABORATORIO') en las primeras 15 filas. "
                "Verifica el formato del Excel."
            )
        self.stdout.write(
            f"   Cabecera fila #{cab} → "
            f"nom={c_nom} | tipo={c_tipo} | sec={c_sec} | sup={c_sup} | ubi={c_ubi} | asigs_desde={c_asig}\n"
        )

        # ── Contadores
        cnts = {
            A_CREATE_ROOT:      0,
            A_CREATE_CHILD:     0,
            A_UPDATE_CHILD:     0,
            A_EXIST_ROOT:       0,
            A_EXIST_CHILD:      0,
            A_SKIP_SUBJECT_ROW: 0,
            A_SKIP_NORM_ROW:    0,
            A_AMBIGUOUS:        0,
        }

        # ── Carry-forward
        lab_actual   = None    # objeto Laboratorio (raíz actual) o None en dry-run
        lab_nom_disp = None    # nombre display del lab actual
        tipo_actual  = None    # último subtipo canónico visto

        def log(fila_num, action, msg=""):
            if verbose:
                self.stdout.write(f"  F{fila_num:>3} {color_action(action)} {msg}")
            cnts[action] += 1

        # ── Procesamiento dentro de transacción atómica
        with transaction.atomic():
            for idx, row in enumerate(ws.iter_rows(min_row=cab + 1, values_only=True)):
                fila_num = cab + 1 + idx

                nom  = get_cell(row, c_nom)
                tipo = get_cell(row, c_tipo)
                sec  = get_cell(row, c_sec)
                sup  = get_cell(row, c_sup)
                ubi  = get_cell(row, c_ubi)

                nom_n  = normalizar_texto(nom)
                tipo_n = normalizar_texto(tipo)
                sec_n  = normalizar_texto(sec)

                # Celdas con contenido real (sin nbsp suelto)
                non_empty = [j for j, c in enumerate(row)
                             if c is not None and limpiar_celda(str(c))]
                if not non_empty:
                    continue

                # Celdas "útiles" (en zona estructural)
                useful = [j for j in non_empty if j < c_asig]

                # ── Sub-cabecera de actividades (PEA / INVESTIGACIÓN)
                first_vals = [normalizar_texto(str(row[j])) for j in non_empty[:3]]
                if any(any(kw in fv for kw in SUBCAB_KEYWORDS) for fv in first_vals):
                    log(fila_num, A_SKIP_NORM_ROW, f"sub-cabecera: {first_vals[:2]}")
                    continue

                # ── Solo columnas de asignatura/norma → nada estructural
                if not useful:
                    log(fila_num, A_SKIP_SUBJECT_ROW, f"cols={non_empty[:4]}")
                    continue

                # ── Actualizar carry del nombre de lab
                if nom_n and nom_n not in {"N", "NOMBRE DEL LABORATORIO"}:
                    nuevo_lab_nom = nom.strip()
                    if nuevo_lab_nom != lab_nom_disp:
                        lab_nom_disp = nuevo_lab_nom
                        # Crear o recuperar el nodo GENERAL
                        if not dry_run:
                            lab_obj, created = Laboratorio.objects.get_or_create(
                                nombre__iexact=lab_nom_disp,
                                clase_nodo=Laboratorio.ClaseNodo.GENERAL,
                                unidad_academica=unidad_academica,
                                defaults={
                                    "nombre": lab_nom_disp,
                                    "campus": campus,
                                    "subtipo_espacio": None,
                                    "parent": None,
                                },
                            )
                            # Garantizar unidad_academica aunque ya exista
                            if not created and lab_obj.unidad_academica_id != unidad_academica.id:
                                lab_obj.unidad_academica = unidad_academica
                                lab_obj.save(update_fields=["unidad_academica"])
                            lab_actual = lab_obj
                        
                        action = A_CREATE_ROOT if (dry_run or created) else A_EXIST_ROOT
                        log(fila_num, action, f"lab={lab_nom_disp!r}")

                # ── Canonizar tipo
                tipo_canon = canon_tipo(tipo_n) if tipo_n else None
                if tipo_canon:
                    tipo_actual = tipo_canon

                # ── Sin nombre de subespacio → fila de apertura de raíz o similar
                if not sec.strip():
                    if not nom.strip():
                        log(fila_num, A_SKIP_SUBJECT_ROW, f"sin sec ni nom · tipo={tipo!r}")
                    continue


                # ── Tiene nombre de subespacio → es un hijo
                if not lab_nom_disp:
                    log(fila_num, A_AMBIGUOUS, f"sec={sec.strip()!r} sin padre carry")
                    continue

                tipo_final = tipo_canon or tipo_actual
                if not tipo_final:
                    log(fila_num, A_AMBIGUOUS,
                        f"lab={lab_nom_disp!r} sec={sec.strip()!r} sin tipo (→ LABORATORIO)")
                    tipo_final = "LABORATORIO"

                # Superficie
                sup_val = None
                if sup:
                    try:
                        sup_val = Decimal(sup.replace(",", ".").replace(" ", ""))
                    except InvalidOperation:
                        log(fila_num, A_AMBIGUOUS, f"SUPERFICIE inválida: {sup!r}")

                if not dry_run:
                    hijo, hijo_created = Laboratorio.objects.get_or_create(
                        nombre__iexact=sec.strip(),
                        parent=lab_actual,
                        subtipo_espacio=tipo_final,
                        defaults={
                            "nombre": sec.strip(),
                            "unidad_academica": unidad_academica,
                            "campus": campus,
                            "clase_nodo": Laboratorio.ClaseNodo.SUBESPACIO,
                            "superficie_m2": sup_val,
                            "ubicacion": ubi or "",
                        },
                    )
                    if not hijo_created:
                        # Actualizar campos que pudieron cambiar
                        changed = []
                        if sup_val is not None and hijo.superficie_m2 != sup_val:
                            hijo.superficie_m2 = sup_val
                            changed.append("superficie_m2")
                        if ubi and hijo.ubicacion != ubi:
                            hijo.ubicacion = ubi
                            changed.append("ubicacion")
                        if hijo.unidad_academica_id != unidad_academica.id:
                            hijo.unidad_academica = unidad_academica
                            changed.append("unidad_academica")
                        if changed:
                            hijo.save(update_fields=changed)
                            action = A_UPDATE_CHILD
                        else:
                            action = A_EXIST_CHILD
                    else:
                        action = A_CREATE_CHILD
                else:
                    # Dry-run: simular
                    hijo_created = True
                    action = A_CREATE_CHILD

                log(fila_num, action,
                    f"[{tipo_final}] {lab_nom_disp!r} → {sec.strip()!r}"
                    + (f" {sup_val}m²" if sup_val else ""))

            if dry_run:
                transaction.set_rollback(True)

        # ── Resumen final ──────────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 62)
        self.stdout.write(self.style.SUCCESS(
            f"📊  RESUMEN{' (DRY-RUN)' if dry_run else ''}:"
        ))
        for action, count in cnts.items():
            color = "\033[92m" if count and action in {A_CREATE_ROOT, A_CREATE_CHILD} \
                    else "\033[33m" if count and action == A_UPDATE_CHILD \
                    else "\033[91m" if count and action == A_AMBIGUOUS \
                    else ""
            self.stdout.write(f"   {color}{action:<20}{_RESET}  {count}")
        self.stdout.write("─" * 62 + "\n")

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _resolver_unidad(self, UnidadAcademica, ref: str):
        """Busca UnidadAcademica por ID numérico o nombre/código (partial match)."""
        if ref.strip().isdigit():
            try:
                return UnidadAcademica.objects.get(pk=int(ref))
            except UnidadAcademica.DoesNotExist:
                raise CommandError(f"No existe UnidadAcademica con ID={ref}.")

        ref_n = normalizar_texto(ref)

        # Intentar exact match normalizado
        for ua in UnidadAcademica.objects.all():
            if normalizar_texto(ua.nombre) == ref_n:
                return ua

        # Partial match
        candidatos = [ua for ua in UnidadAcademica.objects.all()
                      if ref_n in normalizar_texto(ua.nombre)]
        if len(candidatos) == 1:
            return candidatos[0]
        elif len(candidatos) > 1:
            nombres = ", ".join(f"{u.id}:{u.nombre}" for u in candidatos[:5])
            raise CommandError(
                f"Referencia '{ref}' ambigua. Candidatos: {nombres}. "
                "Usa el ID numérico."
            )
        raise CommandError(
            f"No se encontró ninguna UnidadAcademica con nombre/código '{ref}'. "
            "Usa --unidad-academica con el ID numérico (ver admin de Django)."
        )
