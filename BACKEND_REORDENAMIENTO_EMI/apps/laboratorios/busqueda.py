"""
Búsqueda insensible a tildes.

`icontains` en Postgres SÍ distingue tildes, así que buscar "FISICA" no
encontraba ninguno de los 12 laboratorios de "FÍSICA" y "quimica" sólo daba 2 de
16. Como los nombres vienen de Excel escritos de forma irregular (unos con tilde
y otros sin ella), la búsqueda tiene que comparar sobre el texto sin tildes en
ambos lados.

Usa la extensión `unaccent` de PostgreSQL (se habilita con la migración
`0012_extension_unaccent`).
"""

from django.db.models import Func, Q, TextField, Value
from django.db.models.functions import Upper
from rest_framework import filters


class Unaccent(Func):
    """Envuelve la función `unaccent(text)` de PostgreSQL."""

    function = "unaccent"
    output_field = TextField()


class BusquedaSinTildes(filters.SearchFilter):
    """SearchFilter que ignora tildes y mayúsculas.

    Recorre los mismos `search_fields` de la vista, pero comparando
    `upper(unaccent(campo))` contra `upper(unaccent(término))`.
    """

    def filter_queryset(self, request, queryset, view):
        termino = self.get_search_terms(request)
        if not termino:
            return queryset

        campos = getattr(view, "search_fields", None)
        if not campos:
            return queryset

        for palabra in termino:
            condicion = Q()
            for campo in campos:
                # Los prefijos de DRF (^ = empieza por, = igual, @ y $) no se
                # usan en este proyecto; se limpian por si acaso.
                nombre = campo.lstrip("^=@$")
                condicion |= Q(
                    **{
                        f"__busqueda_{nombre.replace('__', '_')}__contains":
                        Upper(Unaccent(Value(palabra)))
                    }
                )
            # Se anotan las expresiones necesarias y se filtra.
            anotaciones = {
                f"__busqueda_{campo.lstrip('^=@$').replace('__', '_')}":
                Upper(Unaccent(campo.lstrip("^=@$")))
                for campo in campos
            }
            queryset = queryset.annotate(**anotaciones).filter(condicion)

        return queryset.distinct()
