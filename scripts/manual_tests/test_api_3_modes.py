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

def test_endpoint(url):
    print(f"\n=========================================")
    print(f"Testing: {url}")
    request = factory.get(url)
    force_authenticate(request, user=user)
    view = ReordenamientoViewSet.as_view({'get': 'comparativa_sedes'})
    response = view(request)
    print(f"Status Code: {response.status_code}")
    print(f"Type of response data: {type(response.data).__name__}")
    
    # Print short version if it's a list
    if isinstance(response.data, list):
        print(f"Array length: {len(response.data)}")
        if len(response.data) > 0:
            print("First item preview:")
            print(json.dumps(response.data[0], indent=2))
        else:
            print("Empty array []")
    else:
        print("Response data:")
        print(json.dumps(response.data, indent=2))

test_endpoint('/api/v1/reordenamientos/comparativa-sedes/')
test_endpoint('/api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=Microscopio')
test_endpoint('/api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=EquipoQueNoExiste123XYZ')
