"""Tests de la subida de PDF en guías de laboratorio."""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.estructura_academica.models import Asignatura, Carrera, Departamento, Semestre
from apps.guias.models import Guia
from apps.usuarios.models import Usuario

MEDIA_TMP = tempfile.mkdtemp()
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class GuiaPdfTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        depto = Departamento.objects.create(nombre="Ciencias de la Producción", codigo="0004")
        cls.carrera = Carrera.objects.create(
            nombre="Ingeniería Industrial", codigo_institucional="C-IND", departamento=depto)
        cls.semestre = Semestre.objects.create(numero=3, nombre="3er Semestre")
        cls.asignatura = Asignatura.objects.create(
            nombre="Fisicoquímica", codigo_curricular="C-IND-03-01",
            carrera=cls.carrera, semestre=cls.semestre)
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="99999999", password="x", nombre_completo="Admin", rol="ADMIN")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _pdf(self, nombre="guia.pdf", contenido=PDF_BYTES):
        return SimpleUploadedFile(nombre, contenido, content_type="application/pdf")

    def test_crea_guia_subiendo_el_pdf(self):
        resp = self.client.post("/api/v1/guias/", {
            "titulo": "Guía de Laboratorio 01 — Fisicoquímica",
            "numero_practica": 1,
            "asignatura": self.asignatura.pk,
            "pdf_archivo": self._pdf(),
        }, format="multipart")

        self.assertEqual(resp.status_code, 201, resp.data)
        guia = Guia.objects.get(asignatura=self.asignatura, numero_practica=1)
        self.assertTrue(guia.pdf_archivo)
        self.assertIn("guias/pdf/", guia.pdf_archivo.name)
        self.assertEqual(guia.pdf_archivo.read(), PDF_BYTES)

    def test_pdf_url_apunta_al_archivo_subido(self):
        self.client.post("/api/v1/guias/", {
            "titulo": "Guía 01", "numero_practica": 1,
            "asignatura": self.asignatura.pk, "pdf_archivo": self._pdf(),
        }, format="multipart")

        datos = self.client.get("/api/v1/guias/").data
        fila = datos["results"][0] if isinstance(datos, dict) else datos[0]
        self.assertTrue(fila["tiene_archivo"])
        self.assertIn("/media/guias/pdf/", fila["pdf_url"])
        self.assertEqual(fila["semestre"], 3)
        self.assertEqual(fila["carrera_nombre"], "Ingeniería Industrial")

    def test_url_externa_sigue_siendo_valida(self):
        """Las guías que sólo tienen enlace externo deben seguir funcionando."""
        resp = self.client.post("/api/v1/guias/", {
            "titulo": "Guía 02", "numero_practica": 2,
            "asignatura": self.asignatura.pk,
            "pdf_url": "https://drive.google.com/file/d/abc/view",
        }, format="multipart")

        self.assertEqual(resp.status_code, 201, resp.data)
        guia = Guia.objects.get(numero_practica=2)
        self.assertFalse(guia.pdf_archivo)
        self.assertEqual(guia.url_pdf(), "https://drive.google.com/file/d/abc/view")

    def test_rechaza_guia_sin_pdf_ni_enlace(self):
        resp = self.client.post("/api/v1/guias/", {
            "titulo": "Guía 03", "numero_practica": 3,
            "asignatura": self.asignatura.pk,
        }, format="multipart")

        self.assertEqual(resp.status_code, 400)
        self.assertIn("pdf_archivo", resp.data)

    def test_rechaza_archivo_que_no_es_pdf(self):
        resp = self.client.post("/api/v1/guias/", {
            "titulo": "Guía 04", "numero_practica": 4,
            "asignatura": self.asignatura.pk,
            "pdf_archivo": self._pdf("guia.docx", b"no soy un pdf"),
        }, format="multipart")

        self.assertEqual(resp.status_code, 400)
        self.assertIn("pdf_archivo", resp.data)

    def test_reemplaza_el_pdf_al_editar(self):
        self.client.post("/api/v1/guias/", {
            "titulo": "Guía 05", "numero_practica": 5,
            "asignatura": self.asignatura.pk, "pdf_archivo": self._pdf("vieja.pdf"),
        }, format="multipart")
        guia = Guia.objects.get(numero_practica=5)

        nuevo = b"%PDF-1.7\nnuevo contenido\n%%EOF\n"
        resp = self.client.patch(f"/api/v1/guias/{guia.pk}/", {
            "pdf_archivo": self._pdf("nueva.pdf", nuevo),
        }, format="multipart")

        self.assertEqual(resp.status_code, 200, resp.data)
        guia.refresh_from_db()
        self.assertIn("nueva", guia.pdf_archivo.name)
        self.assertEqual(guia.pdf_archivo.read(), nuevo)


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class RutasDeGuiasTests(TestCase):
    """El router registra las guías en el prefijo vacío.

    Su ruta de detalle es `^(?P<pk>[^/.]+)/$`, que casa con cualquier sub-ruta
    registrada después. Con `equipos-requeridos` al final, la API respondía 404
    porque interpretaba el nombre como el id de una guía y el endpoint quedaba
    inalcanzable. Estos tests fijan el orden correcto.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="99999001", password="x",
            nombre_completo="Admin", rol="ADMIN")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_equipos_requeridos_es_alcanzable(self):
        resp = self.client.get("/api/v1/guias/equipos-requeridos/")
        self.assertEqual(resp.status_code, 200, resp.data)

    def test_la_lista_de_guias_sigue_respondiendo(self):
        self.assertEqual(self.client.get("/api/v1/guias/").status_code, 200)

    def test_un_id_inexistente_sigue_dando_404(self):
        self.assertEqual(self.client.get("/api/v1/guias/999999/").status_code, 404)
