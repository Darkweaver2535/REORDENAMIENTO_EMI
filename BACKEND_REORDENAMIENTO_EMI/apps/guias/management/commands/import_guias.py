"""
Management command: import_guias
=================================
Da de alta las guías de laboratorio a partir de los PDF oficiales.

El PDF **no se analiza**: se sube tal cual al servidor. Todos los metadatos se
leen del nombre del archivo, que sigue la convención oficial:

    GL <nn> - <s> SEMESTRE-<CARRERA>-<ASIGNATURA>.pdf
    GL 09 - 5 SEMESTRE-INDUSTRIAL-OPERACIONES UNITARIAS I.pdf
     │      │              │           └── asignatura
     │      │              └── carrera (texto libre, se normaliza)
     │      └── semestre 1..10
     └── número de práctica dentro de la carrera

La asignatura se crea si no existe, colgada de la carrera canónica que resuelve
`seed_estructura.resolver_carrera()` y del semestre indicado.

Uso:
    python manage.py import_guias --dir "ruta/carpeta" --dry-run
    python manage.py import_guias --dir "ruta/carpeta"
"""

import glob
import os
import re
import unicodedata

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.laboratorios.management.commands.seed_estructura import (
    resolver_carrera,
    resolver_semestre,
)

PATRON = re.compile(
    r"^GL\s*(?P<num>\d+)\s*-\s*(?P<sem>\d+)\s*SEMESTRE\s*-\s*(?P<carrera>[^-]+?)\s*-\s*(?P<asig>.+)$",
    re.IGNORECASE,
)


def normalizar(valor) -> str:
    s = re.sub(r"\s+", " ", str(valor or "").replace("\xa0", " ")).strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


# Los nombres de archivo van en mayúsculas, sin tildes y con alguna errata de
# tipeo ("DI SEÑO"). Este mapa devuelve el nombre oficial de la asignatura.
# La clave es el nombre normalizado (sin tildes, mayúsculas).
NOMBRES_CANONICOS = {
    "FISICOQUIMICA": "Fisicoquímica",
    "METODOS NUMERICOS": "Métodos Numéricos",
    "QUIMICA ORGANICA": "Química Orgánica",
    "GESTION DE SALUD Y SEGURIDAD OCUPACIONAL": "Gestión de Salud y Seguridad Ocupacional",
    "INGENIERIA DE MATERIALES I": "Ingeniería de Materiales I",
    "INGENIERIA DE MATERIALES II": "Ingeniería de Materiales II",
    "TERMODINAMICA": "Termodinámica",
    "ELECTROTECNIA E INSTALACIONES ELECTRICAS": "Electrotecnia e Instalaciones Eléctricas",
    "OPERACIONES UNITARIAS I": "Operaciones Unitarias I",
    "OPERACIONES UNITARIAS II": "Operaciones Unitarias II",
    "INGENIERIA DE METODOS": "Ingeniería de Métodos",
    "SIMULACION": "Simulación",
    "DI SENO DE PLANTAS INDUSTRIALES": "Diseño de Plantas Industriales",
    "DISENO DE PLANTAS INDUSTRIALES": "Diseño de Plantas Industriales",
    "TECNOLOGIA ALIMENTARIA": "Tecnología Alimentaria",
    "TECNOLOGIAS INDUSTRIALES I": "Tecnologías Industriales I",
    "TECNOLOGIAS INDUSTRIALES II": "Tecnologías Industriales II",
    "AUTOMATIZACION INDUSTRIAL": "Automatización Industrial",
    "PROGRAMACION I": "Programación I",
    "PROGRAMACION II": "Programación II",
    "QUIMICA BASICA": "Química Básica",
    "COMPONENTES, INSTRUMENTACION": "Componentes e Instrumentación",
    "FISICA II": "Física II",
}


def titulo_bonito(texto: str) -> str:
    """'OPERACIONES UNITARIAS I' → 'Operaciones Unitarias I' (romanos intactos)."""
    romanos = {"I", "II", "III", "IV", "V", "VI"}
    menores = {"DE", "DEL", "LA", "EL", "Y", "E", "EN", "PARA", "A"}
    palabras = re.sub(r"\s+", " ", texto).strip().split()
    salida = []
    for i, p in enumerate(palabras):
        if p.upper() in romanos:
            salida.append(p.upper())
        elif i and p.upper() in menores:
            salida.append(p.lower())
        else:
            salida.append(p.capitalize())
    return " ".join(salida)


class Command(BaseCommand):
    help = "Importa las guías de laboratorio subiendo el PDF y leyendo el nombre del archivo."

    def add_arguments(self, parser):
        parser.add_argument("--dir", required=True, help="Carpeta con los PDF 'GL nn - ...'.")
        parser.add_argument("--patron", default="GL*.pdf")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opt):
        from apps.estructura_academica.models import Asignatura, Carrera, Semestre
        from apps.guias.models import Guia

        dry = opt["dry_run"]
        rutas = sorted(glob.glob(os.path.join(opt["dir"], opt["patron"])))
        if not rutas:
            raise CommandError(f"No se encontraron PDF con patrón {opt['patron']!r} en {opt['dir']}")

        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        filas, errores = [], []
        creadas = actualizadas = 0

        with transaction.atomic():
            for ruta in rutas:
                base = os.path.splitext(os.path.basename(ruta))[0]
                m = PATRON.match(base)
                if not m:
                    errores.append((base, "el nombre no sigue el patrón 'GL nn - s SEMESTRE-CARRERA-ASIGNATURA'"))
                    continue

                numero = int(m.group("num"))
                sem_num = resolver_semestre(m.group("sem"))
                cod_carrera = resolver_carrera(m.group("carrera"))
                # El nombre va en mayúsculas, sin tildes y con alguna errata; se
                # busca el nombre oficial y, si no está mapeado, se capitaliza.
                crudo = re.sub(r"\s+", " ", m.group("asig")).strip()
                nombre_asig = NOMBRES_CANONICOS.get(normalizar(crudo), titulo_bonito(crudo))

                if sem_num is None:
                    errores.append((base, f"semestre no reconocido: {m.group('sem')!r}"))
                    continue
                if cod_carrera is None:
                    errores.append((base, f"carrera no reconocida: {m.group('carrera')!r}"))
                    continue

                carrera = Carrera.objects.get(codigo_institucional=cod_carrera)
                semestre = Semestre.objects.get(numero=sem_num)

                # Asignatura: se busca por nombre normalizado dentro de la carrera.
                asignatura = next(
                    (a for a in Asignatura.objects.filter(carrera=carrera)
                     if normalizar(a.nombre) == normalizar(nombre_asig)),
                    None,
                )
                if asignatura is None:
                    codigo = f"{cod_carrera}-{sem_num:02d}-{numero:02d}"[:20]
                    if not dry:
                        asignatura = Asignatura.objects.create(
                            nombre=nombre_asig[:150],
                            codigo_curricular=codigo,
                            carrera=carrera,
                            semestre=semestre,
                        )
                    origen_asig = f"NUEVA ({codigo})"
                else:
                    origen_asig = "existente"

                titulo = f"Guía de Laboratorio {numero:02d} — {nombre_asig}"
                if not dry:
                    guia, creada = Guia.objects.get_or_create(
                        asignatura=asignatura,
                        numero_practica=numero,
                        defaults={
                            "titulo": titulo[:200],
                            "codigo_interno": f"GL-{asignatura.codigo_curricular}-{numero:02d}"[:30],
                        },
                    )
                    guia.titulo = titulo[:200]
                    with open(ruta, "rb") as fh:
                        # save=False para escribir título y archivo en un solo UPDATE.
                        guia.pdf_archivo.save(os.path.basename(ruta), File(fh), save=False)
                    guia.save()
                    creadas += int(creada)
                    actualizadas += int(not creada)
                else:
                    creadas += 1

                filas.append((numero, sem_num, carrera.nombre, nombre_asig, origen_asig,
                              round(os.path.getsize(ruta) / 1e6, 1)))

            if dry:
                transaction.set_rollback(True)

        self.stdout.write("\n" + "═" * 108)
        self.stdout.write(self.style.SUCCESS(
            f"GUÍAS DE LABORATORIO {'(DRY-RUN)' if dry else '(APLICADO)'}"))
        self.stdout.write("═" * 108)
        self.stdout.write(f"{'GL':>3} {'Sem':>4}  {'CARRERA':34} {'ASIGNATURA':38} {'ASIGN.':14} {'MB':>5}")
        self.stdout.write("─" * 108)
        for numero, sem, carrera, asig, origen, mb in sorted(filas, key=lambda f: (f[2], f[1], f[0])):
            self.stdout.write(f"{numero:>3} {sem:>4}  {carrera[:33]:34} {asig[:37]:38} {origen:14} {mb:>5}")
        if errores:
            self.stdout.write(self.style.ERROR("\nARCHIVOS NO IMPORTADOS:"))
            for base, motivo in errores:
                self.stdout.write(self.style.ERROR(f"   ✗ {base}\n       {motivo}"))
        self.stdout.write("─" * 108)
        self.stdout.write(self.style.SUCCESS(
            f"PDF encontrados: {len(rutas)}  ·  guías creadas: {creadas}  ·  "
            f"actualizadas: {actualizadas}  ·  con error: {len(errores)}"))
        self.stdout.write("═" * 108 + "\n")
