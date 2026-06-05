import os
import sys
import django
import json

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.laboratorios.views import EquipoViewSet
from apps.usuarios.models import Usuario
from apps.reordenamiento.views import ReordenamientoViewSet

factory = APIRequestFactory()
user, _ = Usuario.objects.get_or_create(saga_username='test_admin', is_superuser=True)
user.rol = 'ADMIN'
user.save()

def get_response(url):
    request = factory.get(url)
    force_authenticate(request, user=user)
    view = ReordenamientoViewSet.as_view({'get': 'comparativa_sedes'})
    response = view(request)
    return response.data

print("=== JSON GENERAL ===")
print(json.dumps(get_response('/api/v1/reordenamientos/comparativa-sedes/'), indent=2))

print("\n=== JSON MICROSCOPIO ===")
print(json.dumps(get_response('/api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=Microscopio'), indent=2))

