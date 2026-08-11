"""
Management command: build_tipos_equipo
=======================================
Construye el catálogo canónico `TipoEquipo` (#12) y enlaza cada `Equipo`.

El catálogo NO se inventa: sale de la columna AUXILIAR del padrón contable de
Activos Fijos, que ya clasifica cada activo bajo un tipo institucional
("AGITADOR", "BALANZA DE LABORATORIO", "OSCILOSCOPIO", …). `import_activos` la
guarda en `especificaciones["auxiliar"]`, así que aquí sólo hay que consolidarla.

Asignación de `Equipo.tipo`, en dos pasadas:

  1. DIRECTA  — el equipo trae AUXILIAR del padrón: se usa ese tipo tal cual.
  2. HEURÍSTICA — el equipo sólo existe en la ficha técnica del laboratorio (no
     está en el padrón contable): se busca el nombre de tipo más largo que
     coincida con las primeras palabras del nombre del equipo. "MICROSCOPIO
     TRINOCULAR VERTICAL" → MICROSCOPIO; "BALANZA DE LABORATORIO DIGITAL" →
     BALANZA DE LABORATORIO (gana sobre BALANZA por ser más específico).

Uso:
    python manage.py build_tipos_equipo --dry-run
    python manage.py build_tipos_equipo
"""

import re
import unicodedata
from collections import Counter, defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

# Los Excel de Activos Fijos vienen de un sistema con codificación rota:
# la Ñ sale como ¥ y la Ó como À ("BA¥O MARIA", "DILATÀMETRO").
REEMPLAZOS_MOJIBAKE = {"¥": "Ñ", "À": "Ó"}

# Máximo de palabras que puede tener un nombre de tipo al buscar por prefijo.
MAX_TOKENS_TIPO = 5

# El padrón contable recibido cubre sólo el grupo "EQUIPO MEDICO Y DE
# LABORATORIO", así que los laboratorios de informática, el mobiliario y el
# equipo de protección quedan fuera de la columna AUXILIAR. Estos tipos
# completan el catálogo con lo que sí aparece en las fichas técnicas.
TIPOS_COMPLEMENTARIOS = [
    "EQUIPO DE COMPUTACION", "CPU", "MONITOR", "COMPUTADORA PORTATIL",
    "COMPUTADORA", "TECLADO", "MOUSE", "PARLANTES", "ESTABILIZADOR",
    "IMPRESORA", "PROYECTOR", "GABINETE RACK", "SWITCH", "ROUTER",
    "MESA", "SILLON", "ESTANTE", "ARMARIO", "VITRINA",
    "REFRIGERADOR", "COMPRESOR", "PHMETRO", "CAMPANA", "EMBUDO",
    "BINOCULARES", "MASCARA", "TRAJE", "SENSORES", "INTERFAZ",
    "CAPTADOR", "LANZADOR", "MAQUINA", "LEGO",
]


def reparar(texto: str) -> str:
    for malo, bueno in REEMPLAZOS_MOJIBAKE.items():
        texto = texto.replace(malo, bueno)
    return texto


def clave_tipo(valor) -> str:
    """Clave con la que se agrupan las grafías de un mismo tipo.

    Es el nombre normalizado con la última palabra en su forma sin -s final,
    para que "CONTADOR DE COLONIA" y "CONTADOR DE COLONIAS" caigan en la misma
    entrada del catálogo. No pretende ser una lematización correcta: basta con
    que sea consistente a ambos lados de la comparación.
    """
    palabras = normalizar(valor).split()
    if not palabras:
        return ""
    palabras[-1] = palabras[-1].rstrip("S") or palabras[-1]
    return " ".join(palabras)


def normalizar(valor) -> str:
    if valor is None:
        return ""
    s = re.sub(r"\s+", " ", str(valor).replace("\xa0", " ")).strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


class Command(BaseCommand):
    help = "Construye el catálogo TipoEquipo desde el padrón contable y enlaza los equipos."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--verbose", action="store_true")

    def handle(self, *args, **opt):
        from apps.laboratorios.models import Equipo, TipoEquipo

        dry, verbose = opt["dry_run"], opt["verbose"]
        if dry:
            self.stdout.write(self.style.WARNING("\n⚠ DRY-RUN — no se escribe nada\n"))

        equipos = list(Equipo.objects.values("pk", "nombre", "especificaciones"))

        # Tipos ya catalogados en la base: al reconstruir se respeta su grafía.
        ya_en_catalogo = {clave_tipo(n): n
                          for n in TipoEquipo.objects.values_list("nombre", flat=True)}

        # ── 1. Catálogo: valores distintos de AUXILIAR ───────────────────────
        # El padrón escribe el mismo tipo en singular y en plural ("CONTADOR DE
        # COLONIA" y "CONTADOR DE COLONIAS"), así que se agrupan bajo una sola
        # clave; si no, el catálogo se parte en dos entradas que además se
        # reparten los equipos. Se conserva la grafía ya catalogada y, si es la
        # primera carga, la más frecuente en el padrón.
        grafias = defaultdict(Counter)
        for e in equipos:
            aux = (e["especificaciones"] or {}).get("auxiliar")
            if not aux:
                continue
            bonito = reparar(re.sub(r"\s+", " ", aux).strip().upper())
            clave = clave_tipo(bonito)
            if clave:
                grafias[clave][bonito[:120]] += 1

        catalogo = {}
        for clave, cuenta in grafias.items():
            catalogo[clave] = ya_en_catalogo.get(
                clave, max(sorted(cuenta), key=lambda n: cuenta[n]))

        del_padron = len(catalogo)
        for nombre in TIPOS_COMPLEMENTARIOS:
            clave = clave_tipo(nombre)
            if clave in catalogo:
                continue
            catalogo[clave] = ya_en_catalogo.get(clave, nombre)

        self.stdout.write(
            f"📇 Tipos del padrón contable (AUXILIAR): {del_padron}  ·  "
            f"complementarios: {len(catalogo) - del_padron}")

        with transaction.atomic():
            tipos = {}
            creados_cat = 0
            for clave, nombre in catalogo.items():
                if dry:
                    tipos[clave] = nombre
                    creados_cat += 1
                    continue
                tipo, creado = TipoEquipo.objects.get_or_create(
                    nombre=nombre, defaults={"activo": True})
                tipos[clave] = tipo
                creados_cat += int(creado)

            # Índice por nº de palabras, para buscar el prefijo más largo primero.
            por_longitud = {}
            for clave in tipos:
                n = len(clave.split())
                if 1 <= n <= MAX_TOKENS_TIPO:
                    por_longitud.setdefault(n, {})[clave] = tipos[clave]

            # ── 2. Asignación ────────────────────────────────────────────────
            directos = heuristicos = sin_tipo = 0
            ejemplos = []
            for e in equipos:
                aux = (e["especificaciones"] or {}).get("auxiliar")
                tipo = None
                via = ""
                if aux:
                    tipo = tipos.get(clave_tipo(reparar(aux)))
                    via = "padrón"
                if tipo is None:
                    # La puntuación se convierte en separador: hay nombres como
                    # "CPU, PARLANTES, TECLADO, MOUSE" donde el primer token
                    # arrastraría la coma y no casaría con ningún tipo.
                    palabras = re.sub(r"[^A-Z0-9]+", " ", normalizar(e["nombre"])).split()
                    for n in range(min(MAX_TOKENS_TIPO, len(palabras)), 0, -1):
                        # El candidato se reduce con la MISMA clave que el
                        # catálogo; si no, "BINOCULARES" no encontraría el tipo
                        # indexado como "BINOCULARE".
                        cand = clave_tipo(" ".join(palabras[:n]))
                        if cand in por_longitud.get(n, {}):
                            tipo = por_longitud[n][cand]
                            via = "heurística"
                            break

                if tipo is None:
                    sin_tipo += 1
                    continue
                if via == "padrón":
                    directos += 1
                else:
                    heuristicos += 1
                    if len(ejemplos) < 12:
                        ejemplos.append((e["nombre"][:52], getattr(tipo, "nombre", tipo)))
                if not dry:
                    Equipo.objects.filter(pk=e["pk"]).update(tipo=tipo)

            if dry:
                transaction.set_rollback(True)

        total = len(equipos)
        self.stdout.write("\n" + "═" * 78)
        self.stdout.write(self.style.SUCCESS(
            f"CATÁLOGO DE TIPOS {'(DRY-RUN)' if dry else '(APLICADO)'}"))
        self.stdout.write("═" * 78)
        if ejemplos:
            self.stdout.write("Muestras de la pasada heurística:")
            for nombre, tipo in ejemplos:
                self.stdout.write(f"     {nombre:54} → {tipo}")
            self.stdout.write("─" * 78)
        pct = (directos + heuristicos) * 100 // total if total else 0
        self.stdout.write(self.style.SUCCESS(
            f"tipos en el catálogo:        {creados_cat}\n"
            f"equipos con tipo por padrón: {directos}\n"
            f"equipos con tipo heurístico: {heuristicos}\n"
            f"equipos sin tipo:            {sin_tipo}\n"
            f"cobertura:                   {directos + heuristicos}/{total}  ({pct}%)"))
        self.stdout.write("═" * 78 + "\n")
