from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.estructura_academica.models import UnidadAcademica
from apps.guias.models import Guia
from apps.laboratorios.models import Equipo, Laboratorio, TipoEquipo
from apps.reordenamiento.models import Reordenamiento

MESES_ES = [
    "",
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
]

CACHE_KEY = "dashboard:metricas:v2"
CACHE_TTL = 120  # segundos


class DashboardMetricasView(APIView):
    """GET /api/v1/dashboard/metricas/ — métricas y analítica de decisión.

    Además de los KPIs base, provee comparativas por unidad académica (dónde
    sobran/faltan equipos), ranking de laboratorios que requieren atención,
    distribución por tipo de equipo y alertas accionables para jefes.
    Resultado cacheado (TTL corto) por ser una agregación intensiva.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return Response(cached)
        data = self._construir_payload()
        cache.set(CACHE_KEY, data, timeout=CACHE_TTL)
        return Response(data)

    # ── Condición por unidad (#13: estatus_general es el estado canónico) ──────
    @staticmethod
    def _cond_aggregates():
        return {
            "buenos": Count("id", filter=Q(estatus_general="bueno")),
            "regulares": Count("id", filter=Q(estatus_general="regular")),
            "malos": Count("id", filter=Q(estatus_general="malo")),
        }

    def _construir_payload(self):
        total_guias = Guia.objects.count()

        # ── Equipos: totales y condición ──────────────────────────────────────
        cond = Equipo.objects.aggregate(total=Count("id"), **self._cond_aggregates())
        total_equipos = cond["total"] or 0
        buenos = cond["buenos"] or 0
        regulares = cond["regulares"] or 0
        malos = cond["malos"] or 0
        operativos = buenos + regulares
        pct_malos = round((malos / total_equipos) * 100, 1) if total_equipos else 0
        pct_operativos = round((operativos / total_equipos) * 100, 1) if total_equipos else 0

        labs_activos = Laboratorio.objects.filter(is_active=True).count()
        total_unidades = Equipo.objects.values("unidad_academica_id").distinct().count()
        total_tipos = TipoEquipo.objects.count()
        equipos_sin_asignar = Equipo.objects.filter(laboratorio__isnull=True).count()
        equipos_mantenimiento = Equipo.objects.filter(requiere_mantenimiento=True).count()

        pendientes = Reordenamiento.objects.filter(
            estado=Reordenamiento.Estado.PENDIENTE_APROBACION
        ).count()

        # ── Comparativa por unidad académica (dónde sobran/faltan) ────────────
        equipos_por_ua = {
            row["unidad_academica_id"]: row
            for row in Equipo.objects.values("unidad_academica_id").annotate(
                total=Count("id"),
                sin_asignar=Count("id", filter=Q(laboratorio__isnull=True)),
                **self._cond_aggregates(),
            )
        }
        labs_por_ua = {
            row["unidad_academica_id"]: row
            for row in Laboratorio.objects.values("unidad_academica_id").annotate(
                labs=Count("id"),
                capacidad=Sum("capacidad_estudiantes"),
            )
        }
        ua_info = {
            ua.id: (ua.abreviacion or ua.codigo, ua.nombre) for ua in UnidadAcademica.objects.all()
        }

        comparativa = []
        for ua_id, eq in equipos_por_ua.items():
            if ua_id is None:
                sede, nombre = "S/U", "Sin unidad"
            else:
                sede, nombre = ua_info.get(ua_id, ("?", "Desconocida"))
            labs = labs_por_ua.get(ua_id, {})
            total_ua = eq["total"]
            capacidad = labs.get("capacidad") or 0
            ratio = round(total_ua / capacidad, 2) if capacidad else None
            pct_op = (
                round(((eq["buenos"] + eq["regulares"]) / total_ua) * 100, 1) if total_ua else 0
            )
            comparativa.append(
                {
                    "sede": sede,
                    "nombre": nombre,
                    "total": total_ua,
                    "buenos": eq["buenos"],
                    "regulares": eq["regulares"],
                    "malos": eq["malos"],
                    "sin_asignar": eq["sin_asignar"],
                    "labs": labs.get("labs", 0),
                    "capacidad": capacidad,
                    "ratio_equipo_estudiante": ratio,
                    "pct_operativo": pct_op,
                }
            )
        comparativa.sort(key=lambda x: x["total"], reverse=True)

        # equipos_por_sede (compat con el gráfico de barras del frontend)
        equipos_por_sede = [
            {
                "sede": c["sede"],
                "total": c["total"],
                "buenos": c["buenos"],
                "regulares": c["regulares"],
                "malos": c["malos"],
            }
            for c in comparativa
        ]

        # ── Laboratorios que requieren atención (por % de equipos malos) ──────
        labs_criticos = (
            Laboratorio.objects.filter(equipos__isnull=False)
            .values("nombre", "unidad_academica__abreviacion")
            .annotate(
                total=Count("equipos"),
                malos=Count("equipos", filter=Q(equipos__estatus_general="malo")),
            )
            .filter(total__gt=0)
        )
        ranking_labs = sorted(
            (
                {
                    "laboratorio": r["nombre"],
                    "sede": r["unidad_academica__abreviacion"] or "—",
                    "total": r["total"],
                    "malos": r["malos"],
                    "pct_malos": round((r["malos"] / r["total"]) * 100, 1) if r["total"] else 0,
                }
                for r in labs_criticos
            ),
            key=lambda x: (x["pct_malos"], x["malos"]),
            reverse=True,
        )[:8]

        # ── Tipos de equipo más comunes (catálogo #12) ────────────────────────
        tipos_comunes = [
            {"nombre": t["nombre"], "total": t["n"]}
            for t in TipoEquipo.objects.annotate(n=Count("equipos"))
            .filter(n__gt=0)
            .order_by("-n")
            .values("nombre", "n")[:10]
        ]

        # ── Reordenamientos: por estado + serie mensual ───────────────────────
        estado_labels = dict(Reordenamiento.Estado.choices)
        reord_por_estado = [
            {
                "estado": r["estado"],
                "label": estado_labels.get(r["estado"], r["estado"]),
                "total": r["n"],
            }
            for r in Reordenamiento.objects.values("estado").annotate(n=Count("id")).order_by("-n")
        ]

        hace_6_meses = timezone.now() - timezone.timedelta(days=180)
        serie = (
            Reordenamiento.objects.filter(created_at__gte=hace_6_meses)
            .annotate(mes=TruncMonth("created_at"))
            .values("mes")
            .annotate(movimientos=Count("id"))
            .order_by("mes")
        )
        reordenamientos_mensual = [
            {"mes": MESES_ES[r["mes"].month] if r["mes"] else "—", "movimientos": r["movimientos"]}
            for r in serie
        ]

        # ── Alertas accionables ───────────────────────────────────────────────
        alertas = []
        if equipos_sin_asignar:
            alertas.append(
                {
                    "nivel": "warning",
                    "mensaje": f"{equipos_sin_asignar} equipos sin laboratorio asignado.",
                }
            )
        labs_muy_malos = [r for r in ranking_labs if r["pct_malos"] >= 50]
        if labs_muy_malos:
            alertas.append(
                {
                    "nivel": "danger",
                    "mensaje": (
                        f"{len(labs_muy_malos)} laboratorio(s) con 50% o más de equipos en mal estado."
                    ),
                }
            )
        if pendientes:
            alertas.append(
                {
                    "nivel": "info",
                    "mensaje": f"{pendientes} reordenamiento(s) pendiente(s) de aprobación.",
                }
            )
        peor_sede = max(comparativa, key=lambda x: x["malos"], default=None)
        if peor_sede and peor_sede["malos"] > 0:
            alertas.append(
                {
                    "nivel": "warning",
                    "mensaje": (
                        f"{peor_sede['sede']} concentra la mayor cantidad de equipos en mal "
                        f"estado ({peor_sede['malos']})."
                    ),
                }
            )

        return {
            # KPIs base (compat)
            "total_guias_publicadas": total_guias,
            "total_equipos": total_equipos,
            "equipos_malos_porcentaje": pct_malos,
            "laboratorios_activos": labs_activos,
            "reordenamientos_pendientes": pendientes,
            # KPIs nuevos
            "equipos_operativos": operativos,
            "equipos_operativos_porcentaje": pct_operativos,
            "equipos_sin_asignar": equipos_sin_asignar,
            "equipos_mantenimiento": equipos_mantenimiento,
            "total_tipos_equipo": total_tipos,
            "total_unidades": total_unidades,
            # Gráficos / tablas
            "equipos_por_sede": equipos_por_sede,
            "estado_equipos": [
                {"name": "Bueno", "value": buenos},
                {"name": "Regular", "value": regulares},
                {"name": "Malo", "value": malos},
            ],
            "comparativa_unidades": comparativa,
            "ranking_laboratorios_criticos": ranking_labs,
            "tipos_mas_comunes": tipos_comunes,
            "reordenamientos_por_estado": reord_por_estado,
            "reordenamientos_mensual": reordenamientos_mensual,
            "alertas": alertas,
        }
