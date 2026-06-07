"""Tests de la consulta gerencial con IA (contexto determinista + endpoint)."""

from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio, TipoEquipo
from apps.reportes.consultas import construir_contexto, detectar_tipos
from apps.usuarios.models import Usuario

CACHE_IN_MEMORY = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def _client_as(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@override_settings(CACHES=CACHE_IN_MEMORY)
class ConsultaGerencialTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua1 = UnidadAcademica.objects.create(
            nombre="La Paz", ciudad="La Paz", codigo="UALP", abreviacion="UALP", is_active=True
        )
        cls.ua2 = UnidadAcademica.objects.create(
            nombre="Cochabamba", ciudad="Cbba", codigo="UACB", abreviacion="UACB", is_active=True
        )
        cls.lab1 = Laboratorio.objects.create(
            nombre="Biología", unidad_academica=cls.ua1, campus="C", capacidad_estudiantes=20
        )
        cls.tipo = TipoEquipo.objects.create(nombre="MICROSCOPIO")

        # 3 microscopios en UALP, 1 en UACB
        for i in range(3):
            Equipo.objects.create(
                nombre=f"MICROSCOPIO BINOCULAR {i}",
                codigo_activo=f"MIC-LP-{i}",
                laboratorio=cls.lab1,
                unidad_academica=cls.ua1,
                tipo=cls.tipo,
                cantidad_total=1,
                cantidad_buena=1,
                estatus_general="bueno",
            )
        Equipo.objects.create(
            nombre="MICROSCOPIO ELECTRONICO",
            codigo_activo="MIC-CB-1",
            unidad_academica=cls.ua2,
            tipo=cls.tipo,
            cantidad_total=1,
            estatus_general="regular",
        )

        cls.admin = Usuario.objects.create(
            carnet_identidad="ADM_CG", nombre_completo="Admin", rol=Usuario.Rol.ADMIN
        )
        cls.estudiante = Usuario.objects.create(
            carnet_identidad="EST_CG", nombre_completo="Est", rol=Usuario.Rol.ESTUDIANTE
        )

    # ── Detección de tipos ────────────────────────────────────────────────────
    def test_detecta_tipo_en_pregunta(self):
        tipos = detectar_tipos("¿Cuántos microscopios hay a nivel nacional?")
        self.assertEqual([t.nombre for t in tipos], ["MICROSCOPIO"])

    def test_ignora_palabra_conversacional_nivel(self):
        TipoEquipo.objects.create(nombre="NIVEL")  # tipo real (nivel topográfico)
        tipos = detectar_tipos("¿Cuántos microscopios hay a nivel nacional?")
        self.assertIn("MICROSCOPIO", [t.nombre for t in tipos])
        self.assertNotIn("NIVEL", [t.nombre for t in tipos])

    def test_palabra_generica_equipos_no_arrastra_tipo_espurio(self):
        """'¿unidad con más equipos?' es global: no debe detectar ningún tipo.

        Regresión: un tipo basura como 'EQUIP' coincidía por substring dentro de
        'equipos'. El matching por raíz (stem) lo evita.
        """
        TipoEquipo.objects.create(nombre="EQUIP")  # entrada basura del catálogo
        tipos = detectar_tipos("¿cuál es la unidad con más equipos?")
        self.assertEqual(tipos, [])

    def test_detecta_plural(self):
        tipos = detectar_tipos("¿cómo se distribuyen los microscopios?")
        self.assertEqual([t.nombre for t in tipos], ["MICROSCOPIO"])

    # ── Contexto determinista (cifras reales) ─────────────────────────────────
    def test_contexto_agrega_por_tipo_y_sede(self):
        ctx = construir_contexto("¿Cómo se distribuyen los microscopios?")
        self.assertIn("detalle_por_tipo", ctx)
        d = ctx["detalle_por_tipo"][0]
        self.assertEqual(d["tipo"], "MICROSCOPIO")
        self.assertEqual(d["total_nacional"], 4)
        por_sede = {s["sede"]: s["total"] for s in d["distribucion_por_sede"]}
        self.assertEqual(por_sede.get("UALP"), 3)
        self.assertEqual(por_sede.get("UACB"), 1)

    def test_contexto_global_sin_tipo(self):
        ctx = construir_contexto("¿Cómo está el inventario en general?")
        self.assertNotIn("detalle_por_tipo", ctx)
        self.assertEqual(ctx["resumen_nacional"]["total_equipos_nacional"], 4)

    def test_contexto_incluye_unidades_sin_equipos(self):
        """Una UA sin equipos aparece con total 0 y en 'unidades_sin_equipos'."""
        UnidadAcademica.objects.create(
            nombre="Sin Equipos", ciudad="X", codigo="UASE", abreviacion="UASE", is_active=True
        )
        ctx = construir_contexto("¿qué unidad tiene 0 equipos?")
        resumen = ctx["resumen_nacional"]
        self.assertIn("UASE", resumen["unidades_sin_equipos"])
        fila = next(s for s in resumen["por_sede"] if s["sede"] == "UASE")
        self.assertEqual(fila["total"], 0)

    # ── Endpoint (IA mockeada para no depender de Ollama) ─────────────────────
    def test_endpoint_sin_pregunta_400(self):
        resp = _client_as(self.admin).post(
            "/api/v1/reportes/consulta-gerencial/", {}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estudiante_no_puede_consultar(self):
        resp = _client_as(self.estudiante).post(
            "/api/v1/reportes/consulta-gerencial/", {"pregunta": "x"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.reportes.consultas.consultar_ollama")
    def test_saludo_no_vuelca_datos(self, mock_ollama):
        """Un saludo se responde conversacionalmente, sin invocar la IA ni datos."""
        resp = _client_as(self.admin).post(
            "/api/v1/reportes/consulta-gerencial/",
            {"pregunta": "hola, oye una pregunta"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["conversacional"])
        self.assertEqual(resp.data["datos"], {})
        mock_ollama.assert_not_called()  # no se llama al modelo para un saludo

    @patch(
        "apps.reportes.consultas.consultar_ollama",
        return_value=("Respuesta IA simulada", "gemma-test", True),
    )
    def test_endpoint_devuelve_respuesta_y_datos(self, _mock):
        resp = _client_as(self.admin).post(
            "/api/v1/reportes/consulta-gerencial/",
            {"pregunta": "¿Cuántos microscopios hay y cómo se distribuyen?"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["respuesta"], "Respuesta IA simulada")
        self.assertTrue(resp.data["ia_disponible"])
        self.assertEqual(resp.data["datos"]["detalle_por_tipo"][0]["total_nacional"], 4)

    @patch("apps.reportes.consultas.requests.post", side_effect=Exception("ollama caído"))
    def test_fallback_cuando_ollama_no_responde(self, _mock):
        """Si Ollama falla, se devuelve el resumen de datos igualmente (200)."""
        resp = _client_as(self.admin).post(
            "/api/v1/reportes/consulta-gerencial/",
            {"pregunta": "¿Cuántos microscopios hay?"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["ia_disponible"])
        self.assertIn("MICROSCOPIO", resp.data["respuesta"])
