"""
Lectura tolerante de parámetros de consulta.

La API creció con dos nombres para la misma cosa: `estructura_academica` lee
`unidad_academica_id` y `laboratorios` lee `unidad_id`. El frontend mezclaba
ambos, así que varios filtros se enviaban con el nombre que la vista no leía y
se descartaban en silencio — la vista devolvía TODO en vez de filtrar.

`param` acepta todos los alias conocidos, de modo que cualquiera de los dos
nombres funciona y nadie vuelve a quedarse sin filtro por un typo.
"""

# Alias equivalentes por concepto. El primero es el nombre canónico.
ALIAS = {
    "unidad_academica_id": ("unidad_academica_id", "unidad_id", "ua_id"),
    "departamento_id": ("departamento_id", "dept_id", "depto_id"),
    "carrera_id": ("carrera_id",),
    "semestre_id": ("semestre_id",),
    "laboratorio_id": ("laboratorio_id", "lab_id"),
}


def param(request, nombre):
    """Devuelve el id del parámetro buscándolo bajo todos sus alias.

    Descarta lo que no sea un id utilizable y devuelve None ("sin filtro"):

      · la cadena vacía — `?unidad_academica_id=` es "sin filtro", no un filtro
        por la unidad de id vacío;
      · "null" y "undefined" — el frontend los manda cuando su estado todavía
        no cargó;
      · cualquier texto que no sea un número — `?laboratorio_id=abc` llegaba
        hasta el queryset y Django respondía 500 ("expected a number but got
        'abc'"). Una URL manipulada a mano no debe tumbar el endpoint.
    """
    for alias in ALIAS.get(nombre, (nombre,)):
        valor = request.query_params.get(alias)
        if valor in (None, "", "null", "undefined"):
            continue
        if not str(valor).strip().isdigit():
            continue
        return valor
    return None
