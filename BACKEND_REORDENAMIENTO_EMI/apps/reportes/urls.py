from django.urls import path

from apps.reportes.views import (
    ConsultaGerencialView,
    ReporteComparativaSedesView,
    ReporteInventarioLaboratorioView,
    ReporteReordenamientosView,
)

app_name = "reportes"

urlpatterns = [
    # GET /api/v1/reportes/inventario-laboratorio/{pk}/
    path(
        "inventario-laboratorio/<int:pk>/",
        ReporteInventarioLaboratorioView.as_view(),
        name="reporte-inventario",
    ),
    # GET /api/v1/reportes/reordenamientos/?fecha_inicio=&fecha_fin=&estado=
    path(
        "reordenamientos/",
        ReporteReordenamientosView.as_view(),
        name="reporte-reordenamientos",
    ),
    # GET /api/v1/reportes/comparativa-sedes/?nombre_equipo=Microscopio
    path(
        "comparativa-sedes/",
        ReporteComparativaSedesView.as_view(),
        name="reporte-comparativa",
    ),
    # POST /api/v1/reportes/consulta-gerencial/  {"pregunta": "..."}
    path(
        "consulta-gerencial/",
        ConsultaGerencialView.as_view(),
        name="consulta-gerencial",
    ),
]
