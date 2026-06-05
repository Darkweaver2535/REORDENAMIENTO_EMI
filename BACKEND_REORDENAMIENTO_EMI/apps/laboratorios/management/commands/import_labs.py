"""
Management command: import_labs
================================
Importa laboratorios jerárquicos desde un Excel (.xlsx) de la EMI.

Lógica de parser (v3, carry-forward, metadatos académicos):
  - Auto-detecta la fila de cabecera buscando "NOMBRE DEL LABORATORIO"
  - Arrastra el último lab general no vacío como padre (lab_actual)
  - Arrastra el último tipo válido (tipo_actual)
  - Arrastra el último nodo afectado (ultimo_nodo_afectado) para vincular usos académicos
  - CRITERIO ESTRUCTURAL LITERAL: Los usos académicos (Asignaturas) se asignan
    estrictamente al subespacio definido en la misma fila del Excel, independientemente
    de si el nombre de la asignatura sugiere semánticamente otra dependencia.
  - Extrae y acumula banderas de actividades (PEA, Investigación, Servicios) y Normativa.
  - Crea registros en UsoAcademico para las asignaturas asociadas.

Clasifica cada fila:
  CREATE_ROOT      → lab nuevo sin hijo
  CREATE_CHILD     → subespacio nuevo
  UPDATE_CHILD     → subespacio actualizado
  EXIST_ROOT       → lab general existía
  EXIST_CHILD      → subespacio existía
  ADD_USO_ACAD     → fila sin estructura pero con asignatura/actividad
  SKIP_NORM_ROW    → fila de sub-cabecera
  WARN_MISMATCH    → asig no coincide semánticamente con su nodo padre
  AMBIGUOUS        → sec presente pero sin padre
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


A_CREATE_ROOT = "CREATE_ROOT"
A_CREATE_CHILD = "CREATE_CHILD"
A_UPDATE_CHILD = "UPDATE_CHILD"
A_EXIST_ROOT = "EXIST_ROOT"
A_EXIST_CHILD = "EXIST_CHILD"
A_ADD_USO_ACAD = "ADD_USO_ACAD"
A_SKIP_NORM_ROW = "SKIP_NORM_ROW"
A_WARN_MISMATCH = "WARN_MISMATCH"
A_AMBIGUOUS = "AMBIGUOUS"

TIPO_CANON = {
    "SALA": "SALA",
    "AREA": "AREA",
    "SECCION": "SECCION",
    "LABORATORIO": "LABORATORIO",
}

SUBCAB_KEYWORDS = {"PEA", "INVESTIGACION", "VENTA DE SERVICIOS"}


def normalizar_texto(valor: str) -> str:
    if not valor:
        return ""
    s = str(valor).replace("\xa0", " ").replace("\n", " ").replace("\r", " ").replace("\t", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.upper()


def limpiar_celda(valor) -> str:
    if valor is None:
        return ""
    return re.sub(r"\s+", " ", str(valor).replace("\xa0", " ").replace("\n", " ")).strip()


def canon_tipo(raw: str) -> str | None:
    n = normalizar_texto(raw)
    if n in TIPO_CANON:
        return TIPO_CANON[n]
    for k, v in TIPO_CANON.items():
        if n.startswith(k):
            return v
    return None


def detectar_schema(ws):
    for i, row in enumerate(ws.iter_rows(max_row=15, values_only=True), start=1):
        for cell in row:
            if cell and "NOMBRE DEL LABORATORIO" in normalizar_texto(str(cell)):
                col_nom = col_tipo = col_sec = col_sup = col_ubi = None
                col_asig = col_sem = col_car = col_pea = col_inv = col_ven = col_nor = None
                col_asig_start = 999

                for k, c in enumerate(row):
                    nu = normalizar_texto(str(c)) if c else ""
                    if not nu:
                        continue
                    if "NOMBRE DEL LABORATORIO" in nu and col_nom is None:
                        col_nom = k
                    elif (
                        ("SALA" in nu or "AREA" in nu or "SECCION" in nu)
                        and "SELECCIONE" in nu
                        and col_tipo is None
                    ):
                        col_tipo = k
                    elif "NOMBRE DE LA" in nu and col_sec is None:
                        col_sec = k
                    elif "SUPERFICIE" in nu and col_sup is None:
                        col_sup = k
                    elif ("UBICACION" in nu or "UBICACIÓN" in nu) and col_ubi is None:
                        col_ubi = k
                    elif "ASIGNATURA" in nu and col_asig is None:
                        col_asig = k
                        col_asig_start = min(col_asig_start, k)
                    elif "SEMESTRE" in nu and col_sem is None:
                        col_sem = k
                    elif "CARRERA" in nu and col_car is None:
                        col_car = k
                    elif "ACTIVIDAD" in nu and col_pea is None:
                        col_pea = k
                        col_inv = k + 1
                        col_ven = k + 2
                    elif "NORMA" in nu and col_nor is None:
                        col_nor = k

                if col_asig_start == 999:
                    col_asig_start = (col_ubi or col_sup or col_sec or 5) + 1

                return (
                    i,
                    col_nom,
                    col_tipo,
                    col_sec,
                    col_sup,
                    col_ubi,
                    col_asig_start,
                    col_asig,
                    col_sem,
                    col_car,
                    col_pea,
                    col_inv,
                    col_ven,
                    col_nor,
                )
    return (None,) * 14


def get_cell(row, col) -> str:
    if col is None or col >= len(row):
        return ""
    return limpiar_celda(row[col])


_COLORS = {
    A_CREATE_ROOT: "\033[92m",
    A_CREATE_CHILD: "\033[32m",
    A_UPDATE_CHILD: "\033[33m",
    A_EXIST_ROOT: "\033[90m",
    A_EXIST_CHILD: "\033[90m",
    A_ADD_USO_ACAD: "\033[36m",
    A_SKIP_NORM_ROW: "\033[90m",
    A_WARN_MISMATCH: "\033[35m",
    A_AMBIGUOUS: "\033[91m",
}
_RESET = "\033[0m"


def color_action(action: str) -> str:
    return f"{_COLORS.get(action, '')}{action:<17}{_RESET}"


class Command(BaseCommand):
    help = "Importa laboratorios y usos académicos desde un Excel (.xlsx)"

    def add_arguments(self, parser):
        parser.add_argument("archivo", type=str)
        parser.add_argument("--unidad-academica", required=True, metavar="UA")
        parser.add_argument("--campus", default="", metavar="CAMPUS")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--verbose", action="store_true")

    def _resolver_unidad(self, UnidadAcademica, ref: str):
        if ref.strip().isdigit():
            return UnidadAcademica.objects.get(pk=int(ref))
        ref_n = normalizar_texto(ref)
        for ua in UnidadAcademica.objects.all():
            if normalizar_texto(ua.nombre) == ref_n:
                return ua
        candidatos = [
            ua for ua in UnidadAcademica.objects.all() if ref_n in normalizar_texto(ua.nombre)
        ]
        if len(candidatos) == 1:
            return candidatos[0]
        raise CommandError(f"Referencia '{ref}' ambigua/no encontrada.")

    def handle(self, *args, **options):
        if openpyxl is None:
            raise CommandError("openpyxl no instalado")

        from apps.estructura_academica.models import UnidadAcademica
        from apps.laboratorios.models import Laboratorio, UsoAcademico

        archivo, ua_ref, campus, dry_run, verbose = (
            options["archivo"],
            options["unidad_academica"],
            options["campus"],
            options["dry_run"],
            options["verbose"],
        )

        if dry_run:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN activado\n"))
        unidad_academica = self._resolver_unidad(UnidadAcademica, ua_ref)
        self.stdout.write(f"📚 UA: {unidad_academica}\n")

        wb = openpyxl.load_workbook(archivo, data_only=True)
        ws = wb.active

        schema = detectar_schema(ws)
        if schema[0] is None:
            raise CommandError("No se encontró cabecera")
        (
            cab,
            c_nom,
            c_tipo,
            c_sec,
            c_sup,
            c_ubi,
            c_asig_start,
            c_asig,
            c_sem,
            c_car,
            c_pea,
            c_inv,
            c_ven,
            c_nor,
        ) = schema

        cnts = {k: 0 for k in _COLORS.keys()}

        lab_actual = None
        lab_nom_disp = None
        tipo_actual = None
        ultimo_nodo_afectado = None

        def log(fila_num, action, msg=""):
            if verbose:
                self.stdout.write(f"  F{fila_num:>3} {color_action(action)} {msg}")
            cnts[action] += 1

        with transaction.atomic():
            for idx, row in enumerate(ws.iter_rows(min_row=cab + 1, values_only=True)):
                fila_num = cab + 1 + idx

                nom = get_cell(row, c_nom)
                tipo = get_cell(row, c_tipo)
                sec = get_cell(row, c_sec)
                sup = get_cell(row, c_sup)
                ubi = get_cell(row, c_ubi)

                asig = get_cell(row, c_asig)
                sem = get_cell(row, c_sem)
                car = get_cell(row, c_car)
                pea = get_cell(row, c_pea)
                inv = get_cell(row, c_inv)
                ven = get_cell(row, c_ven)
                nor = get_cell(row, c_nor)

                nom_n = normalizar_texto(nom)

                non_empty = [
                    j for j, c in enumerate(row) if c is not None and limpiar_celda(str(c))
                ]
                if not non_empty:
                    continue

                # Sub-cabeceras
                first_vals = [normalizar_texto(str(row[j])) for j in non_empty[:3]]
                if any(any(kw in fv for kw in SUBCAB_KEYWORDS) for fv in first_vals):
                    log(fila_num, A_SKIP_NORM_ROW, "sub-cabecera")
                    continue

                action_main = None

                if nom_n and nom_n not in {"N", "NOMBRE DEL LABORATORIO"}:
                    nuevo_lab_nom = nom.strip()
                    if nuevo_lab_nom != lab_nom_disp:
                        lab_nom_disp = nuevo_lab_nom
                        if not dry_run:
                            lab_obj, created = Laboratorio.objects.get_or_create(
                                nombre__iexact=lab_nom_disp,
                                clase_nodo=Laboratorio.ClaseNodo.GENERAL,
                                unidad_academica=unidad_academica,
                                defaults={"nombre": lab_nom_disp, "campus": campus},
                            )
                            lab_actual = lab_obj
                            ultimo_nodo_afectado = lab_obj
                            action_main = A_CREATE_ROOT if created else A_EXIST_ROOT
                        else:
                            action_main = A_CREATE_ROOT
                            ultimo_nodo_afectado = "MOCK_ROOT"

                        if action_main:
                            log(fila_num, action_main, f"lab={lab_nom_disp!r}")

                tipo_canon = canon_tipo(tipo) if tipo else None
                if tipo_canon:
                    tipo_actual = tipo_canon

                # Proceso de subespacio
                if sec.strip():
                    if not lab_nom_disp:
                        log(fila_num, A_AMBIGUOUS, f"sec={sec.strip()!r} sin padre")
                        continue

                    tipo_final = tipo_canon or tipo_actual or "LABORATORIO"
                    sup_val = None
                    if sup:
                        try:
                            sup_val = Decimal(sup.replace(",", ".").replace(" ", ""))
                        except InvalidOperation:
                            pass

                    if not dry_run:
                        hijo, created = Laboratorio.objects.get_or_create(
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
                        ultimo_nodo_afectado = hijo

                        changed = False
                        if sup_val is not None and hijo.superficie_m2 != sup_val:
                            hijo.superficie_m2 = sup_val
                            changed = True
                        if ubi and hijo.ubicacion != ubi:
                            hijo.ubicacion = ubi
                            changed = True
                        if changed:
                            hijo.save(update_fields=["superficie_m2", "ubicacion"])
                            action_main = A_UPDATE_CHILD
                        else:
                            action_main = A_CREATE_CHILD if created else A_EXIST_CHILD
                    else:
                        ultimo_nodo_afectado = "MOCK_CHILD"
                        action_main = A_CREATE_CHILD

                    log(fila_num, action_main, f"[{tipo_final}] {sec.strip()!r}")

                # Proceso de Usos Académicos y Banderas
                has_acad = asig or pea or inv or ven or nor
                if has_acad and ultimo_nodo_afectado:
                    if not action_main:
                        log(fila_num, A_ADD_USO_ACAD, f"Asignatura: {asig!r}")

                    if (
                        asig
                        and ultimo_nodo_afectado
                        and getattr(ultimo_nodo_afectado, "nombre", None)
                    ):
                        n_nodo = normalizar_texto(ultimo_nodo_afectado.nombre)
                        n_asig = normalizar_texto(asig)
                        # Comprobar heurísticamente si el nodo parece ajeno al nombre de la asignatura
                        if len(n_nodo) > 4 and n_nodo not in n_asig and "LABORATORIO" not in n_nodo:
                            # Puede existir desajuste semántico
                            log(
                                fila_num,
                                A_WARN_MISMATCH,
                                f"'{asig}' -> asignado al nodo literal '{ultimo_nodo_afectado.nombre}'",
                            )

                    if not dry_run:
                        changed = False
                        # boolean flags (any non-empty text usually means "X" or "SI")
                        if pea and not ultimo_nodo_afectado.usa_pea:
                            ultimo_nodo_afectado.usa_pea = True
                            changed = True
                        if inv and not ultimo_nodo_afectado.usa_investigacion:
                            ultimo_nodo_afectado.usa_investigacion = True
                            changed = True
                        if ven and not ultimo_nodo_afectado.usa_venta_servicios:
                            ultimo_nodo_afectado.usa_venta_servicios = True
                            changed = True
                        if nor:
                            actual_norma = ultimo_nodo_afectado.normativa_infraestructura or ""
                            if nor not in actual_norma:
                                sep = " | " if actual_norma else ""
                                ultimo_nodo_afectado.normativa_infraestructura = (
                                    actual_norma + sep + nor
                                )
                                changed = True
                        if changed:
                            ultimo_nodo_afectado.save(
                                update_fields=[
                                    "usa_pea",
                                    "usa_investigacion",
                                    "usa_venta_servicios",
                                    "normativa_infraestructura",
                                ]
                            )

                        if asig:
                            UsoAcademico.objects.get_or_create(
                                laboratorio=ultimo_nodo_afectado,
                                asignatura=asig,
                                defaults={"semestre": sem, "carrera": car},
                            )

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write("\n" + "─" * 62)
        self.stdout.write(self.style.SUCCESS(f"📊 RESUMEN{' (DRY-RUN)' if dry_run else ''}:"))
        for action, count in cnts.items():
            color = _COLORS.get(action, "")
            self.stdout.write(f"   {color}{action:<20}{_RESET}  {count}")
        self.stdout.write("─" * 62 + "\n")
