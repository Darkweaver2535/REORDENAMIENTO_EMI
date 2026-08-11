"""
Forma canónica del código de activo — definición única.

Los Excel de Activos Fijos escriben el mismo código de varias maneras y cada
importador tenía su propia versión de la normalización. En cuanto una cambiaba,
dejaban de cruzarse entre sí y un mismo bien aparecía como dos. Todo el proyecto
usa esta función: importadores, auditoría y normalizador.

Casos que cubre:
    "1 - 12249"          → "1-12249"     espacios alrededor del guion
    "1-1195"             → "1-01195"     correlativo sin ceros a la izquierda
    "1-11353 112560"     → "1-11353"     dos códigos en la misma celda
    "1-12256/1193A"      → "1-12256"     ídem, separados por barra
    "10475"              → "10475"       sin guion (formato válido del padrón)
    "1-03069A"           → "1-03069A"    sufijo alfabético (bien distinto)
"""

import re

# Frases con las que los Excel indican que el bien NO tiene código de activo.
SIN_CODIGO = (
    "NO CUENTA CON COD",
    "SIN CODIGO",
    "SIN CODIFICA",
    "S/C",
    "NO TIENE COD",
    "NO CODIGO",
)


# Separador del sufijo de desambiguación que añade `normalizar_codigos` cuando
# dos bienes DISTINTOS comparten código en el Excel ("1-04865#2"). Se usa "#"
# porque ningún código de activo real lo contiene, así que nunca es ambiguo.
SEP_DESAMBIGUACION = "#"


def canonizar_codigo(valor) -> str:
    bruto = str(valor or "").upper().strip()
    # El sufijo de desambiguación se preserva tal cual.
    bruto, sep, sufijo = bruto.partition(SEP_DESAMBIGUACION)
    s = bruto.strip()
    # Primero se pegan los espacios que rodean al guion ("1 - 12249" →
    # "1-12249"); sólo después se corta por separador, para no quedarse con "1".
    s = re.sub(r"\s*-\s*", "-", s)
    s = re.split(r"[/\s]+", s)[0]
    m = re.match(r"^(\d+)-(\d+)([A-Z]*)$", s)
    if m:
        s = f"{m.group(1)}-{int(m.group(2)):05d}{m.group(3)}"
    return f"{s}{sep}{sufijo}" if sep else s


def codigo_base(valor) -> str:
    """Código sin el sufijo de desambiguación.

    Cuando dos bienes DISTINTOS comparten código en el Excel, el segundo se
    guarda como "1-04865#2". Ese sufijo es nuestro, no del origen: para cruzar
    con el padrón contable hay que comparar por el código base.
    """
    return canonizar_codigo(valor).partition(SEP_DESAMBIGUACION)[0]


def es_sin_codigo(valor) -> bool:
    """True si la celda dice 'no tiene código' en vez de contener un código."""
    import unicodedata

    s = re.sub(r"\s+", " ", str(valor or "")).strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").upper()
    return any(f in s for f in SIN_CODIGO)
