import os
import sys
import django

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db.models import Sum, F, ExpressionWrapper, IntegerField, Max
from apps.laboratorios.models import Equipo, EquipoRequeridoPorGuia, Laboratorio
from apps.laboratorios.services import InventoryAnalyticsService

def obtener_resumen_nacional():
    total_equipos = Equipo.objects.count()
    malos_regulares = Equipo.objects.filter(estatus_general__in=['malo', 'regular']).count()
    pct_malo_regular = round((malos_regulares / total_equipos * 100), 2) if total_equipos > 0 else 0

    sedes_deficit = {}
    reqs = EquipoRequeridoPorGuia.objects.select_related('equipo', 'guia__asignatura').prefetch_related('guia__asignatura__laboratorios__unidad_academica')
    for req in reqs:
        if not req.guia.asignatura: continue
        for lab in req.guia.asignatura.laboratorios.all():
            if lab.unidad_academica:
                sede_name = lab.unidad_academica.nombre
                disp = req.equipo.cantidad_disponible() if req.equipo else 0
                deficit = max(0, req.cantidad_requerida - disp)
                if deficit > 0:
                    sedes_deficit[sede_name] = sedes_deficit.get(sede_name, 0) + deficit

    top_sedes_deficit = sorted([{"sede": k, "deficit": v} for k, v in sedes_deficit.items()], key=lambda x: x["deficit"], reverse=True)[:5]

    equipos = Equipo.objects.annotate(
        max_req=Max('guias_que_requieren__cantidad_requerida'),
        disp=ExpressionWrapper(F('cantidad_buena') + F('cantidad_regular'), output_field=IntegerField())
    ).select_related('laboratorio__unidad_academica')

    total_reasignable = 0
    oportunidades_map = {}
    for eq in equipos:
        disp = eq.disp or 0
        max_req = eq.max_req or 0
        excedente = max(0, disp - max_req)
        if excedente > 0 and (disp > max_req * 2 or max_req == 0):
            total_reasignable += excedente
            nombre = eq.nombre.strip().upper()
            if nombre not in oportunidades_map:
                oportunidades_map[nombre] = True

    oportunidades_reales = []
    for nombre in oportunidades_map.keys():
        comp = InventoryAnalyticsService.comparar_sedes_para_equipo(nombre)
        sedes_con_excedente = [s for s in comp if s["cantidad_disponible"] > (s["cantidad_requerida"] * 2) or (s["cantidad_requerida"] == 0 and s["cantidad_disponible"] > 0)]
        sedes_con_deficit = [s for s in comp if s["deficit"] > 0]
        
        if sedes_con_excedente and sedes_con_deficit:
            for exc in sedes_con_excedente:
                for defc in sedes_con_deficit:
                    excedente_real = exc["cantidad_disponible"] - exc["cantidad_requerida"]
                    mov = min(excedente_real, defc["deficit"])
                    if mov > 0:
                        oportunidades_reales.append({
                            "equipo": nombre,
                            "origen": exc["sede"],
                            "lab_origen": exc["laboratorio"],
                            "destino": defc["sede"],
                            "lab_destino": defc["laboratorio"],
                            "cantidad_sugerida": mov
                        })

    oportunidades_reales.sort(key=lambda x: x["cantidad_sugerida"], reverse=True)

    dist_sedes = {}
    for eq in equipos:
        sede = eq.laboratorio.unidad_academica.nombre if eq.laboratorio and eq.laboratorio.unidad_academica else "Sin Asignar"
        dist_sedes[sede] = dist_sedes.get(sede, 0) + (eq.disp or 0)
    
    distribucion = [{"sede": k, "cantidad": v} for k, v in dist_sedes.items() if v > 0]
    distribucion.sort(key=lambda x: x["cantidad"], reverse=True)

    return {
        "kpis": {
            "porcentaje_malo_regular": pct_malo_regular,
            "total_reasignable": total_reasignable,
        },
        "top_sedes_deficit": top_sedes_deficit,
        "distribucion_sedes": distribucion,
        "oportunidades": oportunidades_reales[:5]
    }

print(obtener_resumen_nacional())
