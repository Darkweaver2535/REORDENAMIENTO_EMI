"""
Management command: fusionar_duplicados
=======================================
Une los ambientes que quedaron registrados dos veces.

La planilla de infraestructura de La Paz lista tres laboratorios de electrónica
DOS veces: una bajo la raíz "ELECTRÓNICA" y otra bajo "TECNOLÓGICO Y CIENCIAS
BÁSICAS". Son el mismo ambiente físico —coinciden la superficie al centímetro y
la ubicación— pero al importarlos quedaron como dos nodos distintos, con las
asignaturas repartidas entre ambos: el árbol mostraba el laboratorio duplicado y
ninguna de las dos fichas tenía la lista completa de usos.

El consolidado nacional los ubica sólo bajo "ELECTRÓNICA", así que ése es el
nodo que se conserva. Al sobrante se le trasladan usos académicos, equipos,
asignaturas y subespacios antes de borrarlo.

Las parejas se declaran una a una a propósito: fusionar por heurística podría
unir dos ambientes que de verdad son distintos (dos laboratorios pueden tener
cada uno su propia "sala de preparación de muestras").

Uso:
    python manage.py fusionar_duplicados --dry-run
    python manage.py fusionar_duplicados
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.laboratorios.management.commands.seed_estructura import clave_uso_academico

# (unidad académica, nombre del ambiente, padre que se conserva, padre que sobra)
FUSIONES = [
    ("UALP", "ELECTRONICA BASICA", "ELECTRÓNICA", "TECNOLÓGICO Y CIENCIAS BASICAS"),
    ("UALP", "ELECTRONICA APLICADA", "ELECTRÓNICA", "TECNOLÓGICO Y CIENCIAS BASICAS"),
    ("UALP", "CONTROL Y AUTOMATIZACION INDUSTRIAL", "ELECTRÓNICA",
     "TECNOLÓGICO Y CIENCIAS BASICAS"),
]


class Command(BaseCommand):
    help = "Fusiona los ambientes duplicados que dejaron los Excel de infraestructura."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opt):
        from apps.laboratorios.models import (
            Equipo,
            Laboratorio,
            LaboratorioAsignatura,
            UsoAcademico,
        )

        dry = opt["dry_run"]
        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        def buscar(ua, nombre, padre):
            return Laboratorio.objects.filter(
                unidad_academica__abreviacion=ua,
                nombre__iexact=nombre,
                parent__nombre__iexact=padre,
            ).first()

        hechas, avisos = [], []
        with transaction.atomic():
            for ua, nombre, padre_ok, padre_sobra in FUSIONES:
                queda = buscar(ua, nombre, padre_ok)
                sobra = buscar(ua, nombre, padre_sobra)
                if queda is None or sobra is None:
                    avisos.append(f"{ua} · {nombre}: nada que fusionar (ya está unificado)")
                    continue

                movidos = {
                    "usos": 0, "equipos": 0, "asignaturas": 0, "subespacios": 0,
                }
                # Usos académicos: sólo los que el nodo que se conserva no tenga.
                # Se comparan con la clave canónica del sistema: los dos Excel
                # escriben el semestre y la carrera de forma distinta y, con el
                # texto crudo, la misma fila se conservaría dos veces.
                existentes = {
                    clave_uso_academico(u.asignatura, u.semestre, u.carrera)
                    for u in UsoAcademico.objects.filter(laboratorio=queda)
                }
                for u in UsoAcademico.objects.filter(laboratorio=sobra):
                    clave = clave_uso_academico(u.asignatura, u.semestre, u.carrera)
                    if clave in existentes:
                        if not dry:
                            u.delete()
                        continue
                    existentes.add(clave)
                    u.laboratorio = queda
                    if not dry:
                        u.save(update_fields=["laboratorio"])
                    movidos["usos"] += 1

                movidos["equipos"] = Equipo.objects.filter(laboratorio=sobra).count()
                movidos["subespacios"] = Laboratorio.objects.filter(parent=sobra).count()
                movidos["asignaturas"] = LaboratorioAsignatura.objects.filter(
                    laboratorio=sobra).exclude(
                    asignatura__in=LaboratorioAsignatura.objects.filter(
                        laboratorio=queda).values("asignatura")).count()
                if not dry:
                    Equipo.objects.filter(laboratorio=sobra).update(laboratorio=queda)
                    Laboratorio.objects.filter(parent=sobra).update(parent=queda)
                    # Las asignaturas ya vinculadas al nodo bueno no se duplican.
                    ya = set(LaboratorioAsignatura.objects.filter(
                        laboratorio=queda).values_list("asignatura_id", flat=True))
                    for la in LaboratorioAsignatura.objects.filter(laboratorio=sobra):
                        if la.asignatura_id in ya:
                            la.delete()
                        else:
                            la.laboratorio = queda
                            la.save(update_fields=["laboratorio"])
                    sobra.delete()

                hechas.append((ua, nombre, padre_sobra, padre_ok, movidos))

        ancho = 88
        self.stdout.write("═" * ancho)
        self.stdout.write(self.style.SUCCESS(
            f"FUSIÓN DE AMBIENTES DUPLICADOS {'(DRY-RUN)' if dry else '(APLICADA)'}"))
        self.stdout.write("═" * ancho)
        for ua, nombre, desde, hacia, m in hechas:
            self.stdout.write(f"  {ua} · {nombre}")
            self.stdout.write(f"       {desde} → {hacia}")
            self.stdout.write(f"       usos +{m['usos']} · equipos {m['equipos']} · "
                              f"asignaturas {m['asignaturas']} · subespacios {m['subespacios']}")
        for a in avisos:
            self.stdout.write(self.style.WARNING(f"  {a}"))
        self.stdout.write("═" * ancho + "\n")
