"""
Consultas gerenciales con IA local (Ollama + gemma).

Responde preguntas en lenguaje natural sobre el inventario a nivel nacional
("¿Cuántos microscopios hay y cómo están distribuidos?") combinando:

  1. Un constructor de CONTEXTO determinista que agrega los datos reales con el
     ORM (totales por sede, condición, laboratorio y tipo de equipo del catálogo
     canónico #12). Las cifras nunca las inventa el modelo.
  2. El modelo de lenguaje (gemma vía Ollama) que redacta una respuesta
     gerencial usando EXCLUSIVAMENTE ese contexto.

Si Ollama no está disponible, se devuelve igualmente el contexto estructurado y
un resumen de respaldo, de modo que la función sigue siendo útil sin el modelo.
"""

import json
import re
import unicodedata

import requests
from django.conf import settings
from django.db.models import Count, Q

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, TipoEquipo

# ── Configuración (sobrescribible por variables de entorno) ──────────────────
OLLAMA_URL = getattr(settings, "OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = getattr(settings, "OLLAMA_MODEL", "gemma4:latest")
OLLAMA_TIMEOUT = getattr(settings, "OLLAMA_TIMEOUT", 120)

_COND = {
    "buenos": Count("id", filter=Q(estatus_general="bueno")),
    "regulares": Count("id", filter=Q(estatus_general="regular")),
    "malos": Count("id", filter=Q(estatus_general="malo")),
}


def _norm(texto):
    texto = " ".join((texto or "").split()).upper()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c))


def _sede_label(abrev, nombre):
    return abrev or nombre or "Sin unidad"


# Palabras que también son nombres de tipo pero aparecen de forma conversacional
# (p. ej. "a NIVEL nacional", "estado GENERAL"); no deben disparar un match por
# sí solas para evitar falsos positivos.
_STOPWORDS_TIPO = {
    "NIVEL",
    "GENERAL",
    "GRADO",
    "MEDIDA",
    "EQUIPO",
    "EQUIPOS",
    "TIPO",
    "TIPOS",
    "ESTADO",
    "TOTAL",
    "CONJUNTO",
    "JUEGO",
    "UNIDAD",
    "UNIDADES",
    "MODELO",
}


def _stem(palabra):
    """Raíz simple para comparar ignorando plurales (microscopios→microscopio).

    Quita signos de puntuación y la terminación de plural (-es / -s). Evita los
    falsos positivos por substring (p. ej. el tipo basura 'EQUIP' ya NO coincide
    con 'equipos', porque sus raíces difieren: EQUIP vs EQUIPO).
    """
    palabra = re.sub(r"[^A-Z0-9]", "", palabra)
    if len(palabra) > 4 and palabra.endswith("ES"):
        return palabra[:-2]
    if len(palabra) > 3 and palabra.endswith("S"):
        return palabra[:-1]
    return palabra


# ── Detección de tipos de equipo mencionados en la pregunta ──────────────────
def detectar_tipos(pregunta, limite=3):
    """Devuelve los TipoEquipo del catálogo mencionados explícitamente.

    Compara por tokens completos (con normalización de plural), no por substring:
    todas las palabras del nombre del tipo deben aparecer en la pregunta. Así
    'microscopios' detecta MICROSCOPIO, pero 'equipos' (palabra genérica) no
    arrastra tipos espurios.
    """
    token_stems = {_stem(t) for t in _norm(pregunta).split()}
    token_stems.discard("")
    encontrados = []
    for tipo in TipoEquipo.objects.all().only("id", "nombre"):
        palabras = _norm(tipo.nombre).split()
        if not palabras:
            continue
        # Tipo genérico de una sola palabra (EQUIPO, NIVEL, GENERAL…): se ignora.
        if len(palabras) == 1 and palabras[0] in _STOPWORDS_TIPO:
            continue
        stems = [_stem(p) for p in palabras]
        if all(s and s in token_stems for s in stems):
            encontrados.append(tipo)
        if len(encontrados) >= limite:
            break
    return encontrados


# ── Construcción del contexto determinista ───────────────────────────────────
def _resumen_global():
    total = Equipo.objects.count()

    # Conteos por unidad (solo las que tienen equipos).
    counts = {
        r["unidad_academica_id"]: r
        for r in Equipo.objects.values("unidad_academica_id").annotate(total=Count("id"), **_COND)
    }

    # Se incluyen TODAS las unidades académicas, con total=0 si no tienen equipos,
    # para poder responder "¿qué unidad tiene 0 equipos?".
    por_sede = []
    for ua in UnidadAcademica.objects.all():
        c = counts.get(ua.id)
        por_sede.append(
            {
                "sede": ua.abreviacion or ua.codigo,
                "nombre": ua.nombre,
                "total": c["total"] if c else 0,
                "buenos": c["buenos"] if c else 0,
                "regulares": c["regulares"] if c else 0,
                "malos": c["malos"] if c else 0,
            }
        )
    if None in counts:  # equipos sin unidad asignada
        c = counts[None]
        por_sede.append(
            {
                "sede": "Sin unidad",
                "nombre": "Sin unidad",
                "total": c["total"],
                "buenos": c["buenos"],
                "regulares": c["regulares"],
                "malos": c["malos"],
            }
        )
    por_sede.sort(key=lambda x: x["total"], reverse=True)

    top_tipos = [
        {"tipo": r["tipo__nombre"], "total": r["total"]}
        for r in Equipo.objects.filter(tipo__isnull=False)
        .values("tipo__nombre")
        .annotate(total=Count("id"))
        .order_by("-total")[:12]
    ]
    return {
        "total_equipos_nacional": total,
        "total_unidades_academicas": len(por_sede),
        "unidades_sin_equipos": [s["sede"] for s in por_sede if s["total"] == 0],
        "por_sede": por_sede,
        "tipos_mas_comunes": top_tipos,
    }


def _detalle_tipo(tipo):
    base = Equipo.objects.filter(tipo=tipo)
    cond = base.aggregate(total=Count("id"), **_COND)
    por_sede = [
        {
            "sede": _sede_label(r["unidad_academica__abreviacion"], r["unidad_academica__nombre"]),
            "total": r["total"],
            "buenos": r["buenos"],
            "regulares": r["regulares"],
            "malos": r["malos"],
        }
        for r in base.values("unidad_academica__abreviacion", "unidad_academica__nombre")
        .annotate(total=Count("id"), **_COND)
        .order_by("-total")
    ]
    por_laboratorio = [
        {
            "laboratorio": r["laboratorio__nombre"] or "Sin asignar",
            "sede": r["laboratorio__unidad_academica__abreviacion"] or "—",
            "total": r["total"],
        }
        for r in base.values("laboratorio__nombre", "laboratorio__unidad_academica__abreviacion")
        .annotate(total=Count("id"))
        .order_by("-total")[:10]
    ]
    return {
        "tipo": tipo.nombre,
        "total_nacional": cond["total"],
        "condicion": {
            "buenos": cond["buenos"],
            "regulares": cond["regulares"],
            "malos": cond["malos"],
        },
        "distribucion_por_sede": por_sede,
        "distribucion_por_laboratorio": por_laboratorio,
    }


def construir_contexto(pregunta):
    """Arma el contexto de datos reales relevante a la pregunta."""
    contexto = {"resumen_nacional": _resumen_global()}
    tipos = detectar_tipos(pregunta)
    if tipos:
        contexto["detalle_por_tipo"] = [_detalle_tipo(t) for t in tipos]
    return contexto


# ── Detección de intención: ¿es una consulta sobre el inventario? ────────────
_KEYWORDS_DATOS = (
    "CUANT",  # cuanto/cuantos/cuantas
    "INVENT",
    "EQUIP",
    "LABORATOR",
    "SEDE",
    "UNIDAD",
    "DISTRIBU",
    "DEFICIT",
    "EXCEDENTE",
    "MANTENIMIENTO",
    "REORDEN",
    "CONDICION",
    "ESTADO",
    "MALO",
    "MALA",
    "BUENO",
    "REGULAR",
    "CATALOG",
    "CANTIDAD",
    "NACIONAL",
    "DONDE",
    "COMPARATIV",
    "TOTAL",
    "INVENTARIO",
)


def tiene_intencion_datos(pregunta):
    """True si la pregunta parece pedir información del inventario."""
    if detectar_tipos(pregunta):
        return True
    norm = _norm(pregunta)
    return any(k in norm for k in _KEYWORDS_DATOS)


MENSAJE_BIENVENIDA = (
    "¡Hola! Soy el asistente gerencial del inventario de laboratorios de la EMI. "
    "Puedo responder preguntas sobre los equipos a nivel nacional. Por ejemplo:\n"
    "• ¿Cuántos microscopios hay y cómo están distribuidos?\n"
    "• ¿Qué unidad académica tiene más balanzas?\n"
    "• ¿Cuántos equipos en mal estado hay y dónde se concentran?\n"
    "Escribe tu consulta y con gusto te ayudo."
)


# ── Respuesta de respaldo (sin LLM) ──────────────────────────────────────────
def _respuesta_respaldo(contexto):
    detalles = contexto.get("detalle_por_tipo")
    if detalles:
        d = detalles[0]
        sedes = ", ".join(f"{s['sede']}: {s['total']}" for s in d["distribucion_por_sede"])
        c = d["condicion"]
        return (
            f"A nivel nacional hay {d['total_nacional']} unidad(es) de tipo "
            f"{d['tipo']}. Distribución por unidad académica: {sedes or 'sin datos'}. "
            f"Condición: {c['buenos']} buenos, {c['regulares']} regulares, {c['malos']} malos."
        )
    g = contexto["resumen_nacional"]
    sedes = ", ".join(f"{s['sede']}: {s['total']}" for s in g["por_sede"])
    return (
        f"El inventario nacional tiene {g['total_equipos_nacional']} equipos. "
        f"Distribución por unidad académica: {sedes or 'sin datos'}."
    )


# ── Llamada al modelo (Ollama) ───────────────────────────────────────────────
SYSTEM_PROMPT = (
    "Eres un asistente gerencial del sistema de laboratorios de la Escuela Militar "
    "de Ingeniería (EMI) de Bolivia. Respondes preguntas para la toma de decisiones "
    "a nivel nacional sobre el inventario de equipos.\n"
    "REGLAS:\n"
    "- Usa EXCLUSIVAMENTE los datos del JSON de contexto. No inventes cifras.\n"
    "- Si el contexto no contiene la información, dilo claramente.\n"
    "- Responde en español, de forma concisa y ejecutiva (máx. ~150 palabras).\n"
    "- Cuando sea útil, menciona cifras concretas y la distribución por unidad académica.\n"
    "- Si el usuario solo saluda o no hace una pregunta concreta sobre el inventario, "
    "salúdalo brevemente e invítalo a preguntar; NO listes datos del inventario.\n"
    "- No muestres el JSON ni tu razonamiento interno; da solo la respuesta final."
)


def consultar_ollama(pregunta, contexto):
    """Llama a gemma vía Ollama. Devuelve (respuesta, modelo, ok)."""
    foco = ""
    detalles = contexto.get("detalle_por_tipo")
    if detalles:
        nombres = ", ".join(d["tipo"] for d in detalles)
        foco = (
            f"\n\nLa pregunta trata sobre el/los tipo(s): {nombres}. Centra la "
            f"respuesta en 'detalle_por_tipo' (totales, distribución por unidad y "
            f"por laboratorio de ese tipo). Usa 'resumen_nacional' solo si aporta."
        )
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "think": False,
        "options": {"temperature": 0.2},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Pregunta del gerente:\n{pregunta}{foco}\n\n"
                    f"Datos de contexto (JSON):\n{json.dumps(contexto, ensure_ascii=False)}"
                ),
            },
        ],
    }
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        texto = (data.get("message") or {}).get("content", "").strip()
        if not texto:
            return _respuesta_respaldo(contexto), OLLAMA_MODEL, False
        return texto, OLLAMA_MODEL, True
    except Exception:
        # Cualquier fallo del modelo (red, timeout, respuesta inválida) cae al
        # resumen determinista: la consulta nunca debe devolver un 500.
        return _respuesta_respaldo(contexto), None, False


def responder_consulta(pregunta):
    """Orquesta: contexto determinista + redacción del modelo.

    Si el mensaje no es una consulta sobre el inventario (saludo, charla), se
    responde de forma conversacional sin volcar datos ni invocar al modelo.
    """
    if not tiene_intencion_datos(pregunta):
        return {
            "pregunta": pregunta,
            "respuesta": MENSAJE_BIENVENIDA,
            "datos": {},
            "modelo": None,
            "ia_disponible": False,
            "conversacional": True,
        }

    contexto = construir_contexto(pregunta)
    respuesta, modelo, ok = consultar_ollama(pregunta, contexto)
    return {
        "pregunta": pregunta,
        "respuesta": respuesta,
        "datos": contexto,
        "modelo": modelo,
        "ia_disponible": ok,
        "conversacional": False,
    }
