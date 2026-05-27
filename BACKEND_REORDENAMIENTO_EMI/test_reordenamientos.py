import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.usuarios.models import Usuario
from apps.laboratorios.models import Laboratorio, Equipo
from apps.reordenamiento.models import Reordenamiento
from django.core.files.uploadedfile import SimpleUploadedFile
import uuid

def run_tests():
    admin_user = Usuario.objects.filter(rol='ADMIN').first()
    if not admin_user:
        print("No admin user found")
        return

    client = APIClient()
    refresh = RefreshToken.for_user(admin_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

    lab1 = Laboratorio.objects.filter(hijos__isnull=True).first()
    lab2 = Laboratorio.objects.filter(hijos__isnull=True).exclude(id=lab1.id).first()
    equipo = Equipo.objects.filter(laboratorio=lab1).first()

    print("--- STARTING TESTS ---")

    print("\nTest 5: Upload de respaldo")
    pdf_file = SimpleUploadedFile("test.pdf", b"file_content", content_type="application/pdf")
    num_doc = f"RES-TEST-{uuid.uuid4().hex[:6]}"
    resp5 = client.post("/api/v1/reordenamientos/", {
        "tipo_movimiento": "REASIGNACION_DEFINITIVA",
        "equipo_id": equipo.id,
        "laboratorio_origen_id": lab1.id,
        "laboratorio_destino_id": lab2.id,
        "cantidad_trasladada": 1,
        "numero_documento": num_doc,
        "documento_respaldo": pdf_file
    }, format="multipart")
    
    print("Status:", resp5.status_code)
    if resp5.status_code == 201:
        reord_id_new = resp5.json().get('id')
        get_resp = client.get(f"/api/v1/reordenamientos/{reord_id_new}/")
        print("Data URL:", get_resp.json().get('documento_url'))
    else:
        print("Data:", resp5.json())

run_tests()
