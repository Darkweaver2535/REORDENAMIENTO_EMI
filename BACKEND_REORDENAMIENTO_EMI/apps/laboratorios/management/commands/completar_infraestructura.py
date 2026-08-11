"""
Management command: completar_infraestructura
=============================================
Rellena los datos de ambiente que la primera importación dejó incompletos.

`verificar_infraestructura` comparó las planillas "INFRAESTRUCTURA DE
LABORATORIOS" contra la base y encontró huecos: ambientes sin superficie, sin
ubicación o sin las banderas de actividad, y asignaturas del Excel que no
llegaron a `UsoAcademico` porque el importador daba de alta un uso por
asignatura y descartaba la misma materia dictada para otra carrera.

Este pase relee las planillas y completa esos campos. Reglas:

  · El Excel de la SEDE manda sobre el consolidado nacional cuando ambos traen
    el mismo campo con distinto texto; el consolidado sólo rellena huecos.
  · Un ambiente sólo se CREA si su nombre no existe ya en esa unidad académica.
    Así se rellenan las salas que faltaban sin volver a duplicar las que
    `fusionar_duplicados` acaba de unir.
  · Los usos académicos se comparan por el trío (asignatura, semestre, carrera)
    normalizado, de modo que la misma materia dictada para dos carreras cuenta
    como dos usos y no se pisan entre sí.

No borra nada y es idempotente.

Uso:
    python manage.py completar_infraestructura --dry-run
    python manage.py completar_infraestructura
"""

import os
import re
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.laboratorios.management.commands.auditar_carga import FAMILIA_A
from apps.laboratorios.management.commands.auditar_carga import Command as Auditar
from apps.laboratorios.management.commands.auditar_carga import norm
from apps.laboratorios.management.commands.seed_estructura import (
    normalizar,
    resolver_carrera,
    resolver_semestre,
)
from apps.laboratorios.management.commands.verificar_infraestructura import ACTIVIDADES
from apps.laboratorios.management.commands.verificar_infraestructura import (
    Command as Verificador,
)

SRC = "/Users/alvaroencinas/Downloads/INFORMACION REORDENAMIENTO EMI"


def clave_uso(asignatura, semestre, carrera):
    """Trío canónico que identifica un uso académico.

    El semestre y la carrera se reducen con el vocabulario del propio sistema:
    "PRIMER" y "PRIMERO" son el mismo semestre, y "T.U.S. SISTEMAS ELECTRÓNICOS"
    y "Tec. Electrónica" son el mismo programa (ambos C-TUS-ETN). Comparar el
    texto crudo daría de alta la misma fila dos veces.
    """
    return (
        re.sub(r"[^A-Z0-9]", "", normalizar(asignatura)),
        resolver_semestre(semestre) or normalizar(semestre),
        resolver_carrera(carrera) or normalizar(carrera),
    )


class Command(BaseCommand):
    help = "Completa superficie, ubicación, normativa, actividades y usos académicos."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--src", default=SRC)

    def handle(self, *args, **opt):
        from apps.estructura_academica.models import UnidadAcademica
        from apps.laboratorios.models import Laboratorio, UsoAcademico

        dry, src = opt["dry_run"], opt["src"]
        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        lector, auditor = Verificador(), Auditar()
        hechos = {"creados": [], "superficie": 0, "ubicacion": 0,
                  "normativa": 0, "actividad": 0, "usos": 0}

        # La sede primero: es la fuente autoritativa y debe ganar los empates.
        orden = sorted(FAMILIA_A, key=lambda f: f[0].startswith("SANTA CRUZ-DATOS"))

        with transaction.atomic():
            for fn, hoja, ua_abrev in orden:
                ruta = os.path.join(src, fn)
                if not os.path.exists(ruta):
                    continue
                unidad = UnidadAcademica.objects.filter(abreviacion=ua_abrev).first()
                if unidad is None:
                    continue
                ambientes = lector._leer(ruta, hoja, auditor._alias(ua_abrev))

                for (raiz, nombre), amb in ambientes.items():
                    nodos = list(Laboratorio.objects.select_related("parent")
                                 .filter(unidad_academica=unidad))
                    por_padre = {(norm(l.parent.nombre) if l.parent else "", norm(l.nombre)): l
                                 for l in nodos}
                    por_nombre = {}
                    for l in nodos:
                        previo = por_nombre.get(norm(l.nombre))
                        if previo is None or (previo.parent_id is None and l.parent_id):
                            por_nombre[norm(l.nombre)] = l

                    lab = por_padre.get((raiz, nombre)) or por_nombre.get(nombre)
                    if lab is None:
                        # Ambiente que nunca se creó. Se cuelga de su raíz.
                        padre = por_nombre.get(raiz)
                        if padre is None or padre.parent_id is not None:
                            padre = None
                        if not dry:
                            lab = Laboratorio.objects.create(
                                nombre=nombre[:150],
                                parent=padre,
                                unidad_academica=unidad,
                                campus=getattr(padre, "campus", "") or unidad.ciudad,
                                clase_nodo=(Laboratorio.ClaseNodo.SUBESPACIO if padre
                                            else Laboratorio.ClaseNodo.GENERAL),
                            )
                        hechos["creados"].append(f"{ua_abrev} · {raiz} → {nombre}")
                        if dry:
                            continue

                    campos = []
                    if amb["sup"] is not None and lab.superficie_m2 is None:
                        lab.superficie_m2 = Decimal(str(amb["sup"]))
                        campos.append("superficie_m2")
                        hechos["superficie"] += 1
                    if amb["ubic"] and not lab.ubicacion:
                        lab.ubicacion = amb["ubic"][:255]
                        campos.append("ubicacion")
                        hechos["ubicacion"] += 1
                    guardada = lab.normativa_infraestructura or ""
                    nuevas = [l for l in amb["norma"]
                              if re.sub(r"[^A-Z0-9]", "", norm(l))
                              not in re.sub(r"[^A-Z0-9]", "", norm(guardada))]
                    if nuevas:
                        sep = " | " if guardada else ""
                        lab.normativa_infraestructura = guardada + sep + " | ".join(nuevas)
                        campos.append("normativa_infraestructura")
                        hechos["normativa"] += 1
                    for clave, attr in (("PEA", "usa_pea"),
                                        ("INVESTIGACION", "usa_investigacion"),
                                        ("VENTA DE SERVICIOS", "usa_venta_servicios")):
                        if amb["act"][clave] and not getattr(lab, attr):
                            setattr(lab, attr, True)
                            campos.append(attr)
                            hechos["actividad"] += 1
                    if campos and not dry:
                        lab.save(update_fields=list(dict.fromkeys(campos)))

                    existentes = {clave_uso(u.asignatura, u.semestre, u.carrera)
                                  for u in UsoAcademico.objects.filter(laboratorio=lab)}
                    for asig, sem, carr in sorted(amb["usos"]):
                        if clave_uso(asig, sem, carr) in existentes:
                            continue
                        existentes.add(clave_uso(asig, sem, carr))
                        hechos["usos"] += 1
                        if not dry:
                            UsoAcademico.objects.create(
                                laboratorio=lab, asignatura=asig[:255],
                                semestre=sem[:50], carrera=carr[:255])

            if dry:
                transaction.set_rollback(True)

        ancho = 88
        self.stdout.write("═" * ancho)
        self.stdout.write(self.style.SUCCESS(
            f"COMPLETADO DE INFRAESTRUCTURA {'(DRY-RUN)' if dry else '(APLICADO)'}"))
        self.stdout.write("═" * ancho)
        self.stdout.write(f"  ambientes creados          : {len(hechos['creados'])}")
        for c in hechos["creados"][:15]:
            self.stdout.write(f"       {c}")
        self.stdout.write(f"  superficies completadas    : {hechos['superficie']}")
        self.stdout.write(f"  ubicaciones completadas    : {hechos['ubicacion']}")
        self.stdout.write(f"  normativas completadas     : {hechos['normativa']}")
        self.stdout.write(f"  banderas de actividad      : {hechos['actividad']}")
        self.stdout.write(f"  usos académicos añadidos   : {hechos['usos']}")
        self.stdout.write("═" * ancho + "\n")
