import os
import sys
import django

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.laboratorios.views import EquipoViewSet
from apps.usuarios.models import Usuario

factory = APIRequestFactory()
request = factory.get('/api/v1/equipos/?modo=compra')

user, _ = Usuario.objects.get_or_create(saga_username='test_admin', is_superuser=True)
user.rol = 'ADMIN'
user.save()

force_authenticate(request, user=user)

view = EquipoViewSet.as_view({'get': 'list'})
response = view(request)
print("Response status:", response.status_code)

if response.status_code == 200 and response.data:
    if isinstance(response.data, dict) and 'results' in response.data:
        data = response.data['results']
    else:
        data = response.data
    print("Found items:", len(data))
    if len(data) > 0:
        print("First item ID:", data[0].get('id'))
        print("First item Name:", data[0].get('nombre'))
else:
    print("Response data:", response.data)

