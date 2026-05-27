import os, sys, django
sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.laboratorios.models import Equipo
print([e.nombre for e in Equipo.objects.all()[:10]])
