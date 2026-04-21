from django.urls import path

from apps.configuracion.views import ConfiguracionView

app_name = "configuracion"

urlpatterns = [
    path("", ConfiguracionView.as_view(), name="configuracion-detalle"),
]
