import os
import sys
import django

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.admin.sites import site
from apps.laboratorios.models import Equipo
from apps.laboratorios.admin import EquipoAdmin
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser
from apps.usuarios.models import Usuario

rf = RequestFactory()
request = rf.get('/')
user, _ = Usuario.objects.get_or_create(saga_username='test_admin', is_superuser=True)
request.user = user

admin_instance = EquipoAdmin(Equipo, site)

Form = admin_instance.get_form(request)
form = Form({'nombre': 'Test Admin', 'codigo_activo': 'ADMIN-001', 'cantidad_total': 1, 'cantidad_buena': 1, 'estatus_general': 'bueno'})

if form.is_valid():
    print("Form is valid! It can be saved without laboratorio.")
else:
    print("Form is INVALID:", form.errors)

