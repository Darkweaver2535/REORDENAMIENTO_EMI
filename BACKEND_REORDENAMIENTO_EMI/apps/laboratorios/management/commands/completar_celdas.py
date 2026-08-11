"""
Management command: completar_celdas
=====================================
Recupera los datos que la primera importación recortó o resumió.

`verificar_celdas` detectó dos pérdidas reales frente a los Excel:

  · UBICACIÓN DEL EQUIPO — se guardaba recortada a 100 caracteres, el largo que
    tenía el campo. Ahora admite 255 y se vuelve a leer completa.
  · AÑO EN QUE SE ADQUIRIÓ — muchas fichas ponen la fecha exacta (14/08/2017)
    y sólo se conservaba el año, perdiendo día y mes. Se añade
    `especificaciones["fecha_adquisicion"]` sin tocar `anio_adquisicion`.
  · ESPECIFICACIONES / FUNCIONALIDAD — se cortaban a 2000 caracteres; el tope
    subió a 8000 y se reescriben completas.
  · FILAS REPETIDAS EN EL ORIGEN — algunos equipos aparecen dos veces en la
    misma hoja con la marca, la foto o el detalle redactados de otro modo. Se
    conserva una sola ficha (son el mismo bien físico) y la redacción alterna
    se guarda en `especificaciones["otra_version_en_origen"]` para no perder
    nada de lo que mandaron las unidades.

Relee las fichas técnicas y completa esos campos en los equipos existentes.
No crea ni borra nada, y es idempotente.

Uso:
    python manage.py completar_celdas --dry-run
    python manage.py completar_celdas
"""

import glob
import os
import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

try:
    import openpyxl
except ImportError:
    openpyxl = None

from apps.laboratorios.codigos import codigo_base, es_sin_codigo
from apps.laboratorios.management.commands.import_equipos import (
    Command as ImportEquipos,
)
from apps.laboratorios.management.commands.import_equipos import (
    limpiar,
    normalizar,
    parse_anio,
    parse_fecha_completa,
    primer_url,
)

SRC = "/Users/alvaroencinas/Downloads/INFORMACION REORDENAMIENTO EMI"

# Archivos que NO son fichas técnicas por laboratorio.
NO_FICHAS = {
    "COCHABAMBA-SISTEMA DE GESTION DE  LABORATORIOS 2026 U.A. CBBA.xlsx",
    "LA PAZ-DATOS DE UBICACIÓN LABORATORIOS - 2026.xlsx",
    "TROPICO-SISTEMA DE GESTIÓN DE LABORATORIOS.xlsx",
    "SANTA CRUZ-DATOS DE UBICACIÓN LABORATORIOS - 2026.xlsx",
    "EQUIPO MEDICO Y LAB. UALP EMI.xlsx",
    "EQUIPO MEDICO Y LABORATORIO UACBBA.xlsx",
    "GRUPO EQUIPO MEDICO Y LABORATORIO UASC.xlsx",
    "LABORATORIO DE LA EMI UAT.xlsx",
    "DETALLE DE ACTIVOS FIJOS EQUIPO MEDICOS Y DE LABORATORIO UA RIBERALTA.xlsx",
    "EQUIPO MEDICO Y DE LABORATORIO OFICINA CENTRAL.xlsx",
}


class Command(BaseCommand):
    help = "Completa ubicación y fecha de adquisición desde las fichas técnicas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--src", default=SRC)

    def _leer_fichas(self, src):
        """Devuelve {codigo_base: [fila, …]} con las celdas de interés.

        Reutiliza el detector de cabeceras del importador para leer exactamente
        las mismas columnas y no volver a inventar el parseo.
        """
        detector = ImportEquipos()
        filas = defaultdict(list)
        for ruta in sorted(glob.glob(os.path.join(src, "*.xlsx"))):
            if os.path.basename(ruta) in NO_FICHAS:
                continue
            wb = openpyxl.load_workbook(ruta, data_only=True)
            for ws in wb.worksheets:
                hr, cols, _ = detector._detectar(ws)
                if hr is None or "cod" not in cols:
                    continue
                for row in ws.iter_rows(min_row=hr + 1, values_only=True):
                    cod = detector._cell(row, cols, "cod")
                    if not cod or es_sin_codigo(cod):
                        continue
                    filas[codigo_base(cod)].append({
                        "ubic": detector._cell(row, cols, "ubic"),
                        "marca": detector._cell(row, cols, "marca"),
                        "espec": detector._cell(row, cols, "espec"),
                        "func": detector._cell(row, cols, "func"),
                        "fecha": parse_fecha_completa(
                            row[cols["anio"]]
                            if "anio" in cols and cols["anio"] < len(row) else None),
                        "anio": parse_anio(detector._cell(row, cols, "anio")),
                        "foto": primer_url(
                            row[cols["foto1"]] if "foto1" in cols and cols["foto1"] < len(row) else None,
                            row[cols["foto2"]] if "foto2" in cols and cols["foto2"] < len(row) else None,
                        ) or "",
                    })
            wb.close()
        return filas

    def handle(self, *args, **opt):
        from apps.laboratorios.models import Equipo

        dry, src = opt["dry_run"], opt["src"]
        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        idx = defaultdict(list)
        for e in Equipo.objects.all():
            idx[codigo_base(e.codigo_activo)].append(e)

        fichas = self._leer_fichas(src)
        ubic_recuperadas, fechas_añadidas = [], 0
        textos_completados, variantes_guardadas = 0, []

        with transaction.atomic():
            for base, filas in fichas.items():
                equipos = idx.get(base)
                if not equipos:
                    continue

                for fila in filas:
                    for eq in equipos:
                        cambios = []
                        ubic = fila["ubic"]
                        if ubic and eq.ubicacion_sala != ubic[:255]:
                            # Sólo se reescribe si lo guardado es un prefijo de
                            # lo del Excel (es decir, venía recortado).
                            if ubic.startswith(eq.ubicacion_sala[:90]) or not eq.ubicacion_sala:
                                ubic_recuperadas.append(
                                    (eq.codigo_activo, len(eq.ubicacion_sala), len(ubic)))
                                eq.ubicacion_sala = ubic[:255]
                                cambios.append("ubicacion_sala")

                        esp = dict(eq.especificaciones or {})
                        tocado = False
                        if fila["fecha"] and esp.get("fecha_adquisicion") != fila["fecha"]:
                            esp["fecha_adquisicion"] = fila["fecha"]
                            fechas_añadidas += 1
                            tocado = True
                        # Textos que la primera carga cortó a 2000 caracteres.
                        for clave, origen in (("especificaciones", "espec"),
                                              ("funcionalidad", "func")):
                            texto = fila[origen]
                            guardado = esp.get(clave, "")
                            if texto and len(texto) > len(guardado) and texto.startswith(guardado[:1500]):
                                esp[clave] = texto[:8000]
                                textos_completados += 1
                                tocado = True
                        if tocado:
                            eq.especificaciones = esp
                            cambios.append("especificaciones")
                        if cambios and not dry:
                            eq.save(update_fields=cambios)

                # Filas repetidas en el origen: el excedente no tiene ficha
                # propia (es el mismo bien), pero su redacción se conserva.
                if len(filas) > len(equipos):
                    eq = equipos[0]
                    esp = dict(eq.especificaciones or {})
                    otras = []
                    actual = {
                        "marca": esp.get("marca_modelo", ""),
                        "espec": esp.get("especificaciones", ""),
                        "foto": eq.foto_url or "",
                        "fecha": esp.get("fecha_adquisicion", ""),
                        "anio": esp.get("anio_adquisicion", ""),
                    }
                    for fila in filas:
                        alt = {k: fila[k] for k in ("marca", "espec", "foto", "fecha", "anio")
                               if fila[k] and fila[k] != actual[k]}
                        if alt and alt not in otras:
                            otras.append(alt)
                    if otras and esp.get("otra_version_en_origen") != otras:
                        esp["otra_version_en_origen"] = otras
                        eq.especificaciones = esp
                        variantes_guardadas.append((eq.codigo_activo, len(otras)))
                        if not dry:
                            eq.save(update_fields=["especificaciones"])

            if dry:
                transaction.set_rollback(True)

        self.stdout.write("═" * 84)
        self.stdout.write(self.style.SUCCESS(
            f"COMPLETADO DE CELDAS {'(DRY-RUN)' if dry else '(APLICADO)'}"))
        self.stdout.write("═" * 84)
        self.stdout.write(f"  ubicaciones recuperadas completas : {len(ubic_recuperadas)}")
        for cod, antes, ahora in ubic_recuperadas[:10]:
            self.stdout.write(f"       {cod:14} {antes} → {ahora} caracteres")
        self.stdout.write(f"  fechas de adquisición añadidas    : {fechas_añadidas}")
        self.stdout.write(f"  textos recuperados completos      : {textos_completados}")
        self.stdout.write(f"  fichas con redacción alterna      : {len(variantes_guardadas)}")
        for cod, n in variantes_guardadas[:10]:
            self.stdout.write(f"       {cod:14} {n} variante(s) del Excel")
        self.stdout.write("═" * 84 + "\n")
