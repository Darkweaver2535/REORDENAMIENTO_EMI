import os
import sys
import django

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from apps.laboratorios.views import EquipoViewSet
from apps.usuarios.models import Usuario

rf = RequestFactory()
request = rf.post('/api/v1/equipos/', {
    'nombre': 'Equipo Test API 3',
    'codigo_activo': 'API-003',
    'cantidad_total': 1,
    'cantidad_buena': 1,
    'estatus_general': 'bueno'
}, content_type='application/json')

user, _ = Usuario.objects.get_or_create(saga_username='test_admin', is_superuser=True)
user.rol = 'ADMIN'
user.save()
request.user = user

from rest_framework.test import force_authenticate
from rest_framework.test import APIRequestFactory
factory = APIRequestFactory()
request = factory.post('/api/v1/equipos/', {
    'nombre': 'Equipo Test API 3',
    'codigo_activo': 'API-003',
    'cantidad_total': 1,
    'cantidad_buena': 1,
    'estatus_general': 'bueno'
}, format='json')
force_authenticate(request, user=user)

view = EquipoViewSet.as_view({'post': 'create'})
response = view(request)
print("Response status:", response.status_code)
print("Response data:", response.data)

