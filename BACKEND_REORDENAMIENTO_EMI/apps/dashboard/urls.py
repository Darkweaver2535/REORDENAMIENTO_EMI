from django.urls import path

from apps.dashboard.views import DashboardMetricasView

app_name = "dashboard"

urlpatterns = [
    path("metricas/", DashboardMetricasView.as_view(), name="dashboard-metricas"),
]
