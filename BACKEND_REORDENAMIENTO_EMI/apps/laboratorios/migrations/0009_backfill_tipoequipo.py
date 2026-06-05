"""
Backfill del catálogo canónico de tipos de equipo (#12).

Crea un TipoEquipo por cada "palabra clave" inicial del nombre de los equipos
físicos y de la demanda teórica de las guías, y enlaza ambos lados por FK.

Heurística (determinista y reversible):
  · Se normaliza el nombre (mayúsculas, espacios colapsados, sin acentos).
  · Se toma la primera palabra significativa como nombre canónico del tipo.
  · Si la primera palabra es genérica (EQUIPO, JUEGO, KIT, ...), se usan las dos
    primeras para no agrupar todo bajo "EQUIPO".

No es una clasificación perfecta: los administradores pueden renombrar/fusionar
tipos y reasignar equipos posteriormente. El objetivo es dar estructura por FK y
reemplazar el matching por texto.
"""

import unicodedata

from django.db import migrations

PALABRAS_GENERICAS = {"EQUIPO", "JUEGO", "SET", "KIT", "APARATO", "INSTRUMENTO", "MODULO"}
PALABRAS_IRRELEVANTES = {"DE", "DEL", "LA", "EL", "Y", "CON", "PARA", "A"}


def _normalizar(texto):
    texto = " ".join((texto or "").split()).upper()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c))


def _tipo_canonico(nombre):
    norm = _normalizar(nombre)
    palabras = [p for p in norm.split() if p not in PALABRAS_IRRELEVANTES and len(p) > 1]
    if not palabras:
        return None
    if palabras[0] in PALABRAS_GENERICAS and len(palabras) > 1:
        return f"{palabras[0]} {palabras[1]}"
    return palabras[0]


def backfill(apps, schema_editor):
    TipoEquipo = apps.get_model("laboratorios", "TipoEquipo")
    Equipo = apps.get_model("laboratorios", "Equipo")
    EquipoRequeridoPorGuia = apps.get_model("laboratorios", "EquipoRequeridoPorGuia")

    cache = {}

    def obtener_tipo(nombre):
        canonico = _tipo_canonico(nombre)
        if not canonico:
            return None
        if canonico not in cache:
            cache[canonico], _ = TipoEquipo.objects.get_or_create(
                nombre=canonico[:120],
                defaults={"categoria": "", "descripcion": "Generado por backfill (#12)."},
            )
        return cache[canonico]

    for equipo in Equipo.objects.all().iterator():
        tipo = obtener_tipo(equipo.nombre)
        if tipo:
            equipo.tipo = tipo
            equipo.save(update_fields=["tipo"])

    for req in EquipoRequeridoPorGuia.objects.all().iterator():
        tipo = obtener_tipo(req.nombre_equipo_teorico)
        if tipo:
            req.tipo = tipo
            req.save(update_fields=["tipo"])


def revertir(apps, schema_editor):
    TipoEquipo = apps.get_model("laboratorios", "TipoEquipo")
    Equipo = apps.get_model("laboratorios", "Equipo")
    EquipoRequeridoPorGuia = apps.get_model("laboratorios", "EquipoRequeridoPorGuia")

    Equipo.objects.update(tipo=None)
    EquipoRequeridoPorGuia.objects.update(tipo=None)
    TipoEquipo.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laboratorios", "0008_tipoequipo_equipo_tipo_equiporequeridoporguia_tipo"),
    ]

    operations = [
        migrations.RunPython(backfill, revertir),
    ]
