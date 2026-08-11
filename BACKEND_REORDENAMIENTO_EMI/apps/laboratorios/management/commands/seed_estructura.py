"""
Management command: seed_estructura
====================================
Siembra el catálogo académico canónico (unidades, departamentos, carreras y
semestres) sobre el que se cuelgan laboratorios, equipos y guías.

Los Excel oficiales escriben la carrera como texto libre y con 28 variantes
para ~18 carreras reales ("MECATRONICA" / "MECATRÓNICA" / "MECATRONICA -
ELECTRONICA", "ING. INDUSTRIAL" / "INDUSTRIAL", …). Aquí vive el mapa que
reduce esas variantes a la carrera canónica; `resolver_carrera()` lo expone
para que lo reutilicen los importadores.

Es idempotente: se puede volver a correr sin duplicar nada.

Uso:
    python manage.py seed_estructura
"""

import re
import unicodedata

from django.core.management.base import BaseCommand
from django.db import transaction

# ── Unidades académicas ─────────────────────────────────────────────────────
# (codigo, nombre, ciudad, abreviacion)
UNIDADES = [
    ("0001", "UALP", "La Paz", "UALP"),
    ("0002", "UASC", "Santa Cruz", "UASC"),
    ("0003", "UACB", "Cochabamba", "UACB"),
    ("0004", "UAR", "Riberalta", "UAR"),
    ("0005", "UAT", "Trópico", "UAT"),
    # Dirección Nacional de Investigación, Ciencia y Tecnología (Oficina Central).
    # Tiene infraestructura propia (LAVEMI, NANOTECNOLOGÍA) e inventario propio.
    ("0006", "DNICYT", "La Paz", "DNICYT"),
]

# ── Departamentos ───────────────────────────────────────────────────────────
DEPARTAMENTOS = [
    ("0001", "Ciencias Básicas y Exactas"),
    ("0002", "Ciencias de la Tierra"),
    ("0003", "Ciencias Tecnológicas"),
    ("0004", "Ciencias de la Producción"),
    ("0005", "Ciencias Económicas y Financieras"),
    ("0006", "Ciencias Jurídicas"),
    ("0007", "Ciencias de la Salud"),
    ("0008", "Investigación y Publicación Científica"),
]

# ── Carreras canónicas: (codigo, nombre, codigo_departamento) ───────────────
CARRERAS = [
    ("C-CB", "Ciencias Básicas", "0001"),
    ("C-CIV", "Ingeniería Civil", "0002"),
    ("C-PET", "Ingeniería Petrolera", "0002"),
    ("C-GEO", "Ingeniería Geográfica", "0002"),
    ("C-AMB", "Ingeniería Ambiental", "0002"),
    ("C-SIS", "Ingeniería de Sistemas", "0003"),
    ("C-ETN", "Ingeniería de Sistemas Electrónicos", "0003"),
    ("C-MEC", "Ingeniería Mecatrónica", "0003"),
    ("C-TEL", "Ingeniería en Telecomunicaciones", "0003"),
    ("C-TUS-INF", "T.U.S. Informática", "0003"),
    ("C-TUS-ETN", "T.U.S. Sistemas Electrónicos", "0003"),
    ("C-TUS-DG", "T.U.S. Diseño Gráfico y Comunicación Audiovisual", "0003"),
    ("C-IND", "Ingeniería Industrial", "0004"),
    ("C-AGI", "Ingeniería Agroindustrial", "0004"),
    ("C-AGR", "Ingeniería Agronómica", "0004"),
    ("C-COM", "Ingeniería Comercial", "0005"),
    ("C-FIN", "Ingeniería Financiera", "0005"),
]

# ── Variantes de texto libre → código de carrera canónica ───────────────────
# Claves ya normalizadas (sin tildes, mayúsculas, espacios colapsados).
ALIAS_CARRERA = {
    "CIENCIAS BASICAS": "C-CB",
    "CS BASICAS": "C-CB",
    "CS. BASICAS": "C-CB",
    "TECNOLOGICO": "C-CB",
    "CIVIL": "C-CIV",
    "INGENIERIA CIVIL": "C-CIV",
    "CONSTRUCCION CIVIL": "C-CIV",
    "PETROLERA": "C-PET",
    "GEOGRAFICA": "C-GEO",
    "AMBIENTAL": "C-AMB",
    "SISTEMAS": "C-SIS",
    "ELECTRONICA": "C-ETN",
    "SISTEMAS ELECTRONICOS": "C-ETN",
    "TEC. ELECTRONICA": "C-TUS-ETN",
    "ETN Y MEC": "C-ETN",
    "MECATRONICA": "C-MEC",
    "MECATRONICA - ELECTRONICA": "C-MEC",
    "TELECOMUNICACION": "C-TEL",
    "ING. TELECOMUNICACIONES": "C-TEL",
    "T.U.S. INFORMATICA": "C-TUS-INF",
    "T.U.S SISTEMAS ELECTRONICOS": "C-TUS-ETN",
    "T.U.S. SISTEMAS ELECTRONICOS": "C-TUS-ETN",
    "T.U.S. DISENO GRAFICO Y COMUNICACION AUDIOVISUAL": "C-TUS-DG",
    "INDUSTRIAL": "C-IND",
    "ING. INDUSTRIAL": "C-IND",
    "AGROINDUSTRIAL": "C-AGI",
    "AGRONOMIA": "C-AGR",
    "ING. COMERCIAL": "C-COM",
    "ING. FINANCIERA": "C-FIN",
}

# ── Oferta académica por sede (tabla CarreraUnidadAcademica) ────────────────
# Dos evidencias, ambas de los Excel oficiales de infraestructura:
#   · la columna "DE QUE CARRERA ES LA ASIGNATURA" de cada hoja de sede, y
#   · los laboratorios raíz de la sede (si hay laboratorio de Petrolera, la sede
#     dicta Petrolera) — así se recuperan las carreras que la columna omitió.
# DNICYT queda vacía a propósito: es la dirección de investigación, no dicta
# carreras, y sus dos laboratorios son de servicio.
OFERTA_POR_SEDE = {
    "0001": ["C-AMB", "C-CB", "C-CIV", "C-COM", "C-ETN", "C-FIN", "C-GEO", "C-IND",
             "C-MEC", "C-PET", "C-SIS", "C-TEL", "C-TUS-DG", "C-TUS-ETN", "C-TUS-INF"],
    "0002": ["C-AGR", "C-AMB", "C-CB", "C-CIV", "C-ETN", "C-IND", "C-MEC", "C-SIS",
             "C-TUS-ETN"],
    "0003": ["C-AGI", "C-CB", "C-CIV", "C-COM", "C-ETN", "C-IND", "C-MEC", "C-PET",
             "C-SIS"],
    "0004": ["C-CB", "C-CIV", "C-COM", "C-SIS"],
    "0005": ["C-CB", "C-CIV"],
    "0006": [],
}

SEMESTRES = [
    (1, "1er Semestre"), (2, "2do Semestre"), (3, "3er Semestre"),
    (4, "4to Semestre"), (5, "5to Semestre"), (6, "6to Semestre"),
    (7, "7mo Semestre"), (8, "8vo Semestre"), (9, "9no Semestre"),
    (10, "10mo Semestre"),
]

# ── Semestre en texto libre → número ────────────────────────────────────────
ALIAS_SEMESTRE = {
    "PRIMER": 1, "PRIMERO": 1, "1ER": 1, "1RO": 1, "1": 1,
    "SEGUNDO": 2, "2DO": 2, "2": 2,
    "TERCER": 3, "TERCERO": 3, "3ER": 3, "3RO": 3, "3": 3,
    "CUARTO": 4, "4TO": 4, "4": 4,
    "QUINTO": 5, "5TO": 5, "5": 5,
    "SEXTO": 6, "6TO": 6, "6": 6,
    "SEPTIMO": 7, "7MO": 7, "7": 7,
    "OCTAVO": 8, "8VO": 8, "8": 8,
    "NOVENO": 9, "9NO": 9, "9": 9,
    "DECIMO": 10, "10MO": 10, "10": 10,
}


def normalizar(valor) -> str:
    if valor is None:
        return ""
    s = re.sub(r"\s+", " ", str(valor).replace("\xa0", " ")).strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper()


def resolver_carrera(texto: str) -> str | None:
    """Texto libre del Excel → código de carrera canónica (o None)."""
    n = normalizar(texto)
    if not n:
        return None
    if n in ALIAS_CARRERA:
        return ALIAS_CARRERA[n]
    # Coincidencia por prefijo: "MECATRONICA - ELECTRONICA" ya está mapeado,
    # pero variantes nuevas como "INDUSTRIAL (PARALELO A)" caen aquí.
    for alias, codigo in sorted(ALIAS_CARRERA.items(), key=lambda x: -len(x[0])):
        if n.startswith(alias) or alias in n:
            return codigo
    return None


def clave_uso_academico(asignatura, semestre, carrera):
    """Trío canónico que identifica un uso académico de un laboratorio.

    La misma materia puede dictarse para dos carreras, y cada Excel escribe el
    semestre y la carrera a su manera ("PRIMER"/"PRIMERO", "T.U.S. SISTEMAS
    ELECTRÓNICOS"/"Tec. Electrónica"). Identificar el uso sólo por la asignatura
    descartaba filas legítimas; compararlo por el texto crudo daba de alta la
    misma dos veces. Esta clave reduce semestre y carrera con el vocabulario
    del propio sistema.
    """
    return (
        re.sub(r"[^A-Z0-9]", "", normalizar(asignatura)),
        resolver_semestre(semestre) or normalizar(semestre),
        resolver_carrera(carrera) or normalizar(carrera),
    )


def resolver_semestre(texto: str) -> int | None:
    """Texto libre del Excel ('SEXTO"A"', '4 TO', 'Primer Semestre') → 1..10."""
    n = normalizar(texto)
    if not n:
        return None
    # Quita comillas, paralelos y la palabra SEMESTRE
    n = re.sub(r'["\'].*$', "", n)
    n = n.replace("SEMESTRE", "").replace(" ", "").strip()
    # "9NOY10MO" → toma el primero
    for sep in ("Y", "-", "/"):
        if sep in n:
            n = n.split(sep)[0]
    if n in ALIAS_SEMESTRE:
        return ALIAS_SEMESTRE[n]
    m = re.match(r"^(\d{1,2})", n)
    if m and 1 <= int(m.group(1)) <= 10:
        return int(m.group(1))
    return None


class Command(BaseCommand):
    help = "Siembra unidades académicas, departamentos, carreras y semestres."

    @transaction.atomic
    def handle(self, *args, **opt):
        from apps.estructura_academica.models import (
            Carrera,
            CarreraUnidadAcademica,
            Departamento,
            DepartamentoUnidadAcademica,
            Semestre,
            UnidadAcademica,
        )

        unidades = {}
        for codigo, nombre, ciudad, abrev in UNIDADES:
            ua, creada = UnidadAcademica.objects.update_or_create(
                codigo=codigo,
                defaults={"nombre": nombre, "ciudad": ciudad,
                          "abreviacion": abrev, "is_active": True},
            )
            unidades[codigo] = ua
            self.stdout.write(f"  {'＋' if creada else '=' } UA   {codigo} {nombre} ({ciudad})")

        deptos = {}
        for codigo, nombre in DEPARTAMENTOS:
            d, creado = Departamento.objects.get_or_create(
                codigo=codigo, defaults={"nombre": nombre})
            if d.nombre != nombre:
                d.nombre = nombre
                d.save(update_fields=["nombre"])
            deptos[codigo] = d
            self.stdout.write(f"  {'＋' if creado else '=' } DEP  {codigo} {nombre}")

        carreras = {}
        for codigo, nombre, cod_depto in CARRERAS:
            c, creada = Carrera.objects.update_or_create(
                codigo_institucional=codigo,
                defaults={"nombre": nombre, "departamento": deptos[cod_depto]},
            )
            carreras[codigo] = c
            self.stdout.write(f"  {'＋' if creada else '=' } CAR  {codigo:10} {nombre}")

        # Un departamento existe en una sede si esa sede dicta al menos una de
        # sus carreras. Vincularlos todos con todas dejaba el filtro de
        # departamentos inservible: devolvía los 8 en cualquier sede.
        depto_por_carrera = {cod: cod_depto for cod, _, cod_depto in CARRERAS}
        for cod_ua, codigos in OFERTA_POR_SEDE.items():
            ua = unidades[cod_ua]
            for cod_carrera in codigos:
                CarreraUnidadAcademica.objects.get_or_create(
                    carrera=carreras[cod_carrera], unidad_academica=ua)

            cods_depto = {depto_por_carrera[c] for c in codigos}
            if cod_ua == "0006":
                # La DNICYT no dicta carreras; su ámbito es la investigación.
                cods_depto = {"0008"}
            for cod_depto in cods_depto:
                DepartamentoUnidadAcademica.objects.get_or_create(
                    departamento=deptos[cod_depto], unidad_academica=ua)
            self.stdout.write(
                f"  ＝ OFERTA {ua.nombre:8} {len(codigos):>2} carreras · "
                f"{len(cods_depto)} departamentos")

        for numero, nombre in SEMESTRES:
            s, creado = Semestre.objects.get_or_create(
                numero=numero, defaults={"nombre": nombre})
            self.stdout.write(f"  {'＋' if creado else '=' } SEM  {numero:>2} {nombre}")

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ {UnidadAcademica.objects.count()} unidades · "
            f"{Departamento.objects.count()} departamentos · "
            f"{Carrera.objects.count()} carreras · "
            f"{Semestre.objects.count()} semestres · "
            f"{CarreraUnidadAcademica.objects.count()} carreras por sede\n"))
