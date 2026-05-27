import os, sys, django, json
sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.reordenamiento.views import ReordenamientoViewSet
from apps.usuarios.models import Usuario
factory = APIRequestFactory()
user, _ = Usuario.objects.get_or_create(saga_username='test_admin', is_superuser=True)
user.rol = 'ADMIN'
user.save()
request = factory.get('/api/v1/reordenamientos/comparativa-sedes/?nombre_equipo=PARROT')
force_authenticate(request, user=user)
view = ReordenamientoViewSet.as_view({'get': 'comparativa_sedes'})
response = view(request)
print("Array length:", len(response.data))
if len(response.data) > 0:
    print(json.dumps(response.data[0], indent=2))
