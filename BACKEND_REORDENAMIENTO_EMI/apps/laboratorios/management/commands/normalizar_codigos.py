"""
Management command: normalizar_codigos
=======================================
Deja `Equipo.codigo_activo` en una única forma canónica y elimina las filas que
los Excel repetían.

Los Excel escriben el mismo código de siete maneras ("1-12249", "1 - 12249",
"1-1195" sin ceros, "10475" sin guion, "1-12256/1193A" con dos códigos en una
celda). Guardarlos tal cual impide buscar un activo por su código y hace que el
mismo bien parezca dos.

Qué hace:

  1. DEDUPLICA  — cuando dos filas comparten código canónico, laboratorio y
     nombre, son la misma fila repetida en el Excel: se conserva la más completa.
  2. CANONIZA   — "1 - 1195" → "1-01195". El valor original se guarda en
     `especificaciones["codigo_origen"]` cuando difiere, para no perder trazabilidad.
  3. DESAMBIGUA — dos bienes DISTINTOS con el mismo código en el origen (error de
     codificación de Activos Fijos) se conservan ambos: el segundo pasa a
     "<codigo>#2" y queda marcado en `especificaciones["codigo_duplicado_en_origen"]`.
     Nunca se descarta un bien físico real.

Uso:
    python manage.py normalizar_codigos --dry-run
    python manage.py normalizar_codigos
"""

import re
import unicodedata
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction


def normalizar(valor):
    s = re.sub(r"\s+", " ", str(valor or "")).strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


from apps.laboratorios.codigos import SEP_DESAMBIGUACION, canonizar_codigo  # noqa: E402


class Command(BaseCommand):
    help = "Canoniza los códigos de activo y elimina las filas repetidas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opt):
        from apps.laboratorios.models import Equipo

        dry = opt["dry_run"]
        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        equipos = list(Equipo.objects.select_related("laboratorio"))
        grupos = defaultdict(list)
        for e in equipos:
            grupos[canonizar_codigo(e.codigo_activo)].append(e)

        def completitud(e):
            """Prefiere la fila con más información al deduplicar."""
            esp = e.especificaciones or {}
            return (len(esp), bool(e.foto_url), len(e.observaciones or ""), -e.pk)

        borrar, renombrar, marcar_origen = [], [], []

        for canon, filas in grupos.items():
            if len(filas) == 1:
                e = filas[0]
                if e.codigo_activo != canon:
                    renombrar.append((e, canon, False))
                continue

            # Agrupar por bien físico: mismo laboratorio y mismo nombre.
            por_bien = defaultdict(list)
            for e in filas:
                por_bien[(e.laboratorio_id, normalizar(e.nombre))].append(e)

            bienes = []
            for _, repetidas in por_bien.items():
                repetidas.sort(key=completitud, reverse=True)
                bienes.append(repetidas[0])
                borrar.extend(repetidas[1:])      # filas repetidas del Excel

            # Bienes distintos que comparten código en el origen: se conservan
            # todos, desambiguando el segundo y siguientes.
            bienes.sort(key=lambda e: e.pk)
            for i, e in enumerate(bienes):
                nuevo = canon if i == 0 else f"{canon}{SEP_DESAMBIGUACION}{i + 1}"
                if e.codigo_activo != nuevo:
                    renombrar.append((e, nuevo, len(bienes) > 1))
                elif len(bienes) > 1:
                    marcar_origen.append(e)

        # ── Reporte ──────────────────────────────────────────────────────
        self.stdout.write("═" * 88)
        self.stdout.write(self.style.SUCCESS("NORMALIZACIÓN DE CÓDIGOS DE ACTIVO"))
        self.stdout.write("═" * 88)
        self.stdout.write(f"  equipos analizados                    : {len(equipos)}")
        self.stdout.write(f"  filas repetidas en el Excel (se borran): {len(borrar)}")
        self.stdout.write(f"  códigos que cambian de forma          : {len(renombrar)}")
        self.stdout.write(f"  bienes distintos con código compartido: "
                          f"{len({c for _, c, dup in renombrar if dup}) + len(marcar_origen)}")

        if borrar:
            self.stdout.write("\n  FILAS REPETIDAS QUE SE ELIMINAN:")
            for e in borrar:
                self.stdout.write(
                    f"     − {e.codigo_activo:18} {e.nombre[:40]:42} @ {str(e.laboratorio)[:30]}")

        muestra = [r for r in renombrar if r[0].codigo_activo != r[1]][:12]
        if muestra:
            self.stdout.write("\n  MUESTRA DE CÓDIGOS CANONIZADOS:")
            for e, nuevo, dup in muestra:
                nota = "  (código compartido en origen)" if dup else ""
                self.stdout.write(f"     {e.codigo_activo:20} → {nuevo:20}{nota}")

        if dry:
            self.stdout.write(self.style.WARNING(
                "\n⚠ DRY-RUN. Ejecuta sin --dry-run para aplicar.\n"))
            return

        with transaction.atomic():
            for e in borrar:
                e.delete()

            # Se libera el código antiguo antes de asignar el definitivo: el
            # campo es único y dos equipos pueden intercambiar valores.
            for e, _, _ in renombrar:
                Equipo.objects.filter(pk=e.pk).update(codigo_activo=f"__tmp__{e.pk}")

            for e, nuevo, dup in renombrar:
                esp = dict(e.especificaciones or {})
                if canonizar_codigo(e.codigo_activo) != e.codigo_activo:
                    esp.setdefault("codigo_origen", e.codigo_activo)
                if dup:
                    esp["codigo_duplicado_en_origen"] = True
                Equipo.objects.filter(pk=e.pk).update(
                    codigo_activo=nuevo[:50], especificaciones=esp)

            for e in marcar_origen:
                esp = dict(e.especificaciones or {})
                esp["codigo_duplicado_en_origen"] = True
                Equipo.objects.filter(pk=e.pk).update(especificaciones=esp)

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Aplicado. Equipos: {Equipo.objects.count()}\n"))
