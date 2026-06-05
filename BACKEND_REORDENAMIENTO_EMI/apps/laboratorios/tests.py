"""Tests de subida de foto (#11), catálogo TipoEquipo (#12) y modelo unidad (#13)."""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio, TipoEquipo
from apps.laboratorios.services import InventoryAnalyticsService
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


@override_settings(CACHES=CACHE_IN_MEMORY)
class TipoEquipoCatalogoTests(TestCase):
    """#12: catálogo canónico y matching tipo-aware con fallback a texto."""

    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(
            nombre="UA Tipo", ciudad="C", codigo="UATP", abreviacion="UATP", is_active=True
        )
        cls.lab = Laboratorio.objects.create(
            nombre="Lab T", unidad_academica=cls.ua, campus="C", capacidad_estudiantes=10
        )
        cls.tipo = TipoEquipo.objects.create(nombre="BALANZA")
        cls.balanza = Equipo.objects.create(
            nombre="BALANZA DIGITAL CAP 30KG",
            codigo_activo="EQ-BAL-01",
            laboratorio=cls.lab,
            unidad_academica=cls.ua,
            tipo=cls.tipo,
            cantidad_total=1,
            cantidad_buena=1,
        )
        cls.admin = Usuario.objects.create(
            carnet_identidad="ADM_TP",
            nombre_completo="Admin Tipo",
            rol=Usuario.Rol.ADMIN,
            unidad_academica=cls.ua,
        )
        cls.estudiante = Usuario.objects.create(
            carnet_identidad="EST_TP",
            nombre_completo="Est Tipo",
            rol=Usuario.Rol.ESTUDIANTE,
            unidad_academica=cls.ua,
        )

    def test_listar_tipos_con_conteo(self):
        resp = _client_as(self.admin).get("/api/v1/laboratorios/tipos-equipo/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        fila = next(t for t in resp.data["results"] if t["nombre"] == "BALANZA")
        self.assertEqual(fila["total_equipos"], 1)

    def test_estudiante_no_puede_crear_tipo(self):
        resp = _client_as(self.estudiante).post(
            "/api/v1/laboratorios/tipos-equipo/", {"nombre": "NUEVO"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_resolver_tipo_desde_termino_largo(self):
        """'BALANZA DIGITAL ...' resuelve al tipo canónico BALANZA."""
        tipo = InventoryAnalyticsService._resolver_tipo("BALANZA DIGITAL CAP 30KG")
        self.assertIsNotNone(tipo)
        self.assertEqual(tipo.nombre, "BALANZA")

    def test_resolver_tipo_inexistente_devuelve_none(self):
        self.assertIsNone(InventoryAnalyticsService._resolver_tipo("xyzqwerty"))

    def test_comparar_sedes_usa_tipo_fk(self):
        """El matching encuentra la balanza por tipo aunque el nombre físico sea largo."""
        resultados = InventoryAnalyticsService.comparar_sedes_para_equipo("BALANZA")
        fila = next((r for r in resultados if r["laboratorio"] == "Lab T"), None)
        self.assertIsNotNone(fila)
        self.assertEqual(fila["cantidad_disponible"], 1)

    def test_equipo_serializa_tipo(self):
        resp = _client_as(self.admin).get(f"/api/v1/laboratorios/equipos/{self.balanza.id}/")
        self.assertEqual(resp.data["tipo_id"], self.tipo.id)
        self.assertEqual(resp.data["tipo_nombre"], "BALANZA")


@override_settings(CACHES=CACHE_IN_MEMORY)
class EquipoUnidadIndividualTests(TestCase):
    """#13: cada equipo es una unidad individual (cantidad 0 o 1)."""

    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(
            nombre="UA Unidad", ciudad="C", codigo="UAUN", abreviacion="UAUN", is_active=True
        )
        cls.lab = Laboratorio.objects.create(
            nombre="Lab U", unidad_academica=cls.ua, campus="C", capacidad_estudiantes=10
        )
        cls.encargado = Usuario.objects.create(
            carnet_identidad="ENC_UN",
            nombre_completo="Enc Unidad",
            rol=Usuario.Rol.ENCARGADO_ACTIVOS,
            unidad_academica=cls.ua,
        )

    def _crear(self, cantidad_total):
        return _client_as(self.encargado).post(
            "/api/v1/laboratorios/equipos/",
            {
                "nombre": "Equipo X",
                "codigo_activo": f"EQ-UN-{cantidad_total}",
                "laboratorio_id": self.lab.id,
                "cantidad_total": cantidad_total,
                "cantidad_buena": min(cantidad_total, 1),
            },
            format="json",
        )

    def test_acepta_unidad(self):
        self.assertEqual(self._crear(1).status_code, status.HTTP_201_CREATED)

    def test_rechaza_lote(self):
        resp = self._crear(5)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cantidad_total", resp.data)
