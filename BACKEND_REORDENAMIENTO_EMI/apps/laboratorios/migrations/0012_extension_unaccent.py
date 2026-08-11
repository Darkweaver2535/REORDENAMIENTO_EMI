"""Habilita `unaccent` en PostgreSQL para la búsqueda insensible a tildes."""

from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("laboratorios", "0011_laboratorio_uq_lab_nombre_parent_ua_and_more"),
    ]

    operations = [
        UnaccentExtension(),
    ]
