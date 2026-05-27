import os
import sys
import django

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.laboratorios.models import Equipo, Laboratorio

lab = Laboratorio.objects.first()

print("\n--- TEST: CREAR EQUIPO SIN LABORATORIO (NULL) ---")
eq_sin = Equipo.objects.create(nombre="Microscopio COMPRA", codigo_activo="COMPRA-001", laboratorio=None)
print(f"Creado: {eq_sin.nombre} con laboratorio={eq_sin.laboratorio_id}")

print("\n--- TEST: CREAR EQUIPO CON LABORATORIO ---")
eq_con = Equipo.objects.create(nombre="Microscopio LAB", codigo_activo="LAB-001", laboratorio=lab)
print(f"Creado: {eq_con.nombre} con laboratorio={eq_con.laboratorio_id}")

print("\n--- ENDPOINT MODO NORMAL (laboratorio_id=X) ---")
qs_normal = Equipo.objects.filter(laboratorio_id=lab.id)
print("Devuelve solo los asignados a ese lab:")
for e in qs_normal:
    print(f" - ID:{e.id} | {e.nombre} | lab:{e.laboratorio_id}")

print("\n--- ENDPOINT MODO COMPRA (laboratorio__isnull=True) ---")
qs_compra = Equipo.objects.filter(laboratorio__isnull=True)
print("Devuelve SOLO los equipos recién ingresados sin laboratorio:")
for e in qs_compra:
    print(f" - ID:{e.id} | {e.nombre} | lab:{e.laboratorio_id}")

# Clean up
eq_sin.delete()
eq_con.delete()
