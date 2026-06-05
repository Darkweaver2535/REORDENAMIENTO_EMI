"""Tests de subida de foto de equipo (#11)."""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio
from apps.usuarios.models import Usuario

_MEDIA_TMP = tempfile.mkdtemp(prefix="test_media_")
CACHE_IN_MEMORY = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# PNG mínimo válido (firma + IHDR)
_PNG_BYTES = bytes.fromhex("89504e470d0a1a0a0000000d49484452")


def _client_as(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@override_settings(CACHES=CACHE_IN_MEMORY, MEDIA_ROOT=_MEDIA_TMP)
class SubirFotoEquipoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(
            nombre="UA Foto", ciudad="C", codigo="UAFT", abreviacion="UAFT", is_active=True
        )
        cls.lab = Laboratorio.objects.create(
            nombre="Lab Foto", unidad_academica=cls.ua, campus="Campus", capacidad_estudiantes=10
        )
        cls.eq = Equipo.objects.create(
            nombre="Equipo Foto",
            codigo_activo="EQ-FOTO-01",
            laboratorio=cls.lab,
            unidad_academica=cls.ua,
            cantidad_total=1,
            cantidad_buena=1,
        )
        cls.encargado = Usuario.objects.create(
            carnet_identidad="ENC_FOTO",
            nombre_completo="Encargado Foto",
            rol=Usuario.Rol.ENCARGADO_ACTIVOS,
            unidad_academica=cls.ua,
        )
        cls.estudiante = Usuario.objects.create(
            carnet_identidad="EST_FOTO",
            nombre_completo="Estudiante Foto",
            rol=Usuario.Rol.ESTUDIANTE,
            unidad_academica=cls.ua,
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def _png(self, nombre="foto.png"):
        return SimpleUploadedFile(nombre, _PNG_BYTES, content_type="image/png")

    def test_encargado_sube_foto_y_actualiza_foto_url(self):
        url = f"/api/v1/laboratorios/equipos/{self.eq.id}/subir-foto/"
        resp = _client_as(self.encargado).post(url, {"foto": self._png()}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("foto_url", resp.data)
        self.eq.refresh_from_db()
        self.assertTrue(self.eq.foto_url)
        self.assertIn("equipos/fotos/", self.eq.foto_url)

    def test_sin_archivo_devuelve_400(self):
        url = f"/api/v1/laboratorios/equipos/{self.eq.id}/subir-foto/"
        resp = _client_as(self.encargado).post(url, {}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_formato_invalido_devuelve_400(self):
        url = f"/api/v1/laboratorios/equipos/{self.eq.id}/subir-foto/"
        archivo = SimpleUploadedFile("virus.exe", b"MZ", content_type="application/octet-stream")
        resp = _client_as(self.encargado).post(url, {"foto": archivo}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estudiante_no_puede_subir(self):
        url = f"/api/v1/laboratorios/equipos/{self.eq.id}/subir-foto/"
        resp = _client_as(self.estudiante).post(url, {"foto": self._png()}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
