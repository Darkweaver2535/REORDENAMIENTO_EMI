"""Tests de los filtros en cascada de la estructura académica.

Cubren el fallo que tenían: el frontend enviaba `unidad_id` / `dept_id` y las
vistas leían `unidad_academica_id` / `departamento_id`, así que el filtro se
descartaba en silencio y el endpoint devolvía TODO el catálogo en vez de la
selección. Ahora ambos nombres funcionan.
"""

from rest_framework.test import APIClient, APITestCase

from apps.estructura_academica.models import (
    Asignatura,
    Carrera,
    CarreraUnidadAcademica,
    Departamento,
    DepartamentoUnidadAcademica,
    Semestre,
    UnidadAcademica,
)
from apps.usuarios.models import Usuario

BASE = "/api/v1/estructura_academica"


class FiltrosCascadaTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.lapaz = UnidadAcademica.objects.create(
            nombre="UALP", ciudad="La Paz", codigo="0001")
        cls.tropico = UnidadAcademica.objects.create(
            nombre="UAT", ciudad="Trópico", codigo="0005")

        cls.produccion = Departamento.objects.create(
            nombre="Ciencias de la Producción", codigo="0004")
        cls.tierra = Departamento.objects.create(
            nombre="Ciencias de la Tierra", codigo="0002")
        # Producción existe en ambas sedes; Tierra sólo en La Paz.
        for depto in (cls.produccion, cls.tierra):
            DepartamentoUnidadAcademica.objects.create(
                departamento=depto, unidad_academica=cls.lapaz)
        DepartamentoUnidadAcademica.objects.create(
            departamento=cls.produccion, unidad_academica=cls.tropico)

        cls.industrial = Carrera.objects.create(
            nombre="Ingeniería Industrial", codigo_institucional="C-IND",
            departamento=cls.produccion)
        cls.agro = Carrera.objects.create(
            nombre="Ingeniería Agroindustrial", codigo_institucional="C-AGI",
            departamento=cls.produccion)
        cls.petrolera = Carrera.objects.create(
            nombre="Ingeniería Petrolera", codigo_institucional="C-PET",
            departamento=cls.tierra)
        # La Paz dicta Industrial y Petrolera; el Trópico sólo Agroindustrial.
        CarreraUnidadAcademica.objects.create(carrera=cls.industrial, unidad_academica=cls.lapaz)
        CarreraUnidadAcademica.objects.create(carrera=cls.petrolera, unidad_academica=cls.lapaz)
        CarreraUnidadAcademica.objects.create(carrera=cls.agro, unidad_academica=cls.tropico)

        cls.sem3 = Semestre.objects.create(numero=3, nombre="3er Semestre")
        cls.sem4 = Semestre.objects.create(numero=4, nombre="4to Semestre")
        Asignatura.objects.create(
            nombre="Fisicoquímica", codigo_curricular="A1",
            carrera=cls.industrial, semestre=cls.sem3)
        Asignatura.objects.create(
            nombre="Termodinámica", codigo_curricular="A2",
            carrera=cls.industrial, semestre=cls.sem4)
        Asignatura.objects.create(
            nombre="Fitoquímica", codigo_curricular="A3",
            carrera=cls.agro, semestre=cls.sem3)

        cls.usuario = Usuario.objects.create_superuser(
            carnet_identidad="12121212", password="x",
            nombre_completo="Tester", rol="ADMIN")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)

    def _nombres(self, url):
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200, resp.data)
        datos = resp.data
        filas = datos["results"] if isinstance(datos, dict) and "results" in datos else datos
        return sorted(f["nombre"] for f in filas)

    # ── Departamentos ────────────────────────────────────────────────────
    def test_departamentos_filtran_por_unidad(self):
        self.assertEqual(
            self._nombres(f"{BASE}/departamentos/?unidad_academica_id={self.tropico.pk}"),
            ["Ciencias de la Producción"],
        )

    def test_departamentos_aceptan_el_alias_unidad_id(self):
        """El frontend enviaba `unidad_id`; antes se ignoraba y devolvía todo."""
        self.assertEqual(
            self._nombres(f"{BASE}/departamentos/?unidad_id={self.tropico.pk}"),
            ["Ciencias de la Producción"],
        )

    def test_departamentos_sin_filtro_devuelven_todos(self):
        self.assertEqual(len(self._nombres(f"{BASE}/departamentos/")), 2)

    # ── Carreras ─────────────────────────────────────────────────────────
    def test_carreras_filtran_por_departamento(self):
        self.assertEqual(
            self._nombres(f"{BASE}/carreras/?departamento_id={self.tierra.pk}"),
            ["Ingeniería Petrolera"],
        )

    def test_carreras_aceptan_el_alias_dept_id(self):
        """El frontend enviaba `dept_id`; antes se ignoraba y listaba las 17."""
        self.assertEqual(
            self._nombres(f"{BASE}/carreras/?dept_id={self.tierra.pk}"),
            ["Ingeniería Petrolera"],
        )

    def test_carreras_filtran_por_sede(self):
        """Una carrera se dicta sólo en algunas sedes (CarreraUnidadAcademica)."""
        self.assertEqual(
            self._nombres(f"{BASE}/carreras/?unidad_academica_id={self.tropico.pk}"),
            ["Ingeniería Agroindustrial"],
        )

    def test_carreras_combinan_departamento_y_sede(self):
        """Producción tiene 2 carreras, pero La Paz sólo dicta Industrial."""
        url = (f"{BASE}/carreras/?departamento_id={self.produccion.pk}"
               f"&unidad_academica_id={self.lapaz.pk}")
        self.assertEqual(self._nombres(url), ["Ingeniería Industrial"])

    def test_parametro_vacio_no_filtra(self):
        """`?unidad_academica_id=` es 'sin filtro', no un filtro por id vacío."""
        self.assertEqual(len(self._nombres(f"{BASE}/carreras/?unidad_academica_id=")), 3)

    def test_parametro_undefined_no_rompe(self):
        """El frontend puede mandar la cadena 'undefined' si el estado no cargó."""
        self.assertEqual(
            len(self._nombres(f"{BASE}/carreras/?unidad_academica_id=undefined")), 3)

    # ── Asignaturas ──────────────────────────────────────────────────────
    def test_asignaturas_filtran_por_carrera_y_semestre(self):
        url = f"{BASE}/asignaturas/?carrera_id={self.industrial.pk}&semestre_id={self.sem3.pk}"
        self.assertEqual(self._nombres(url), ["Fisicoquímica"])


class AltaUnidadAcademicaTests(APITestCase):
    """El panel de administración debe poder dar de alta unidades académicas.

    Antes el ViewSet no incluía `CreateModelMixin`: el botón "Agregar Unidad
    Académica" existía en la UI pero la API respondía 405 y el formulario nunca
    podía completarse. Además el modelo exige `codigo` (único) que el formulario
    no pide, así que se genera como correlativo.
    """

    @classmethod
    def setUpTestData(cls):
        UnidadAcademica.objects.create(nombre="UALP", ciudad="La Paz", codigo="0001")
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="55550001", password="x",
            nombre_completo="Admin", rol="ADMIN")
        cls.estudiante = Usuario.objects.create_user(
            carnet_identidad="55550002", password="x",
            nombre_completo="Estudiante", rol="ESTUDIANTE")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_crea_unidad_generando_el_codigo(self):
        resp = self.client.post(f"{BASE}/unidades-academicas/", {
            "nombre": "UANUEVA", "abreviacion": "UAN", "ciudad": "Sucre"})
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["codigo"], "0002")  # 0001 ya estaba tomado

    def test_respeta_el_codigo_si_lo_envian(self):
        resp = self.client.post(f"{BASE}/unidades-academicas/", {
            "nombre": "UAOTRA", "abreviacion": "UAO", "ciudad": "Tarija", "codigo": "0099"})
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["codigo"], "0099")

    def test_rechaza_nombre_duplicado(self):
        resp = self.client.post(f"{BASE}/unidades-academicas/", {
            "nombre": "ualp", "abreviacion": "X", "ciudad": "Y"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("nombre", resp.data)

    def test_estudiante_no_puede_crear(self):
        self.client.force_authenticate(user=self.estudiante)
        resp = self.client.post(f"{BASE}/unidades-academicas/", {
            "nombre": "UAX", "abreviacion": "X", "ciudad": "Y"})
        self.assertEqual(resp.status_code, 403)

    def test_estudiante_sigue_pudiendo_listarlas(self):
        """Los filtros en cascada de todo el sistema las consultan."""
        self.client.force_authenticate(user=self.estudiante)
        self.assertEqual(self.client.get(f"{BASE}/unidades-academicas/").status_code, 200)


class ParametrosBasuraTests(APITestCase):
    """Una URL manipulada a mano no debe tumbar el endpoint.

    `?laboratorio_id=abc` llegaba hasta el queryset y Django respondía 500
    ("Field 'id' expected a number but got 'abc'"). Ahora un id que no es un
    número se trata como "sin filtro", igual que ya se hacía con la cadena vacía
    y con los "undefined" que manda el frontend cuando su estado no ha cargado.
    """

    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(
            nombre="UA Param", ciudad="X", codigo="PARM1")
        cls.usuario = Usuario.objects.create_superuser(
            carnet_identidad="83000001", password="x",
            nombre_completo="Admin", rol="ADMIN")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)

    def test_id_con_texto_no_rompe_el_inventario(self):
        resp = self.client.get("/api/v1/laboratorios/equipos/?laboratorio_id=abc")
        self.assertEqual(resp.status_code, 200)

    def test_id_con_texto_no_rompe_la_cascada(self):
        resp = self.client.get(f"{BASE}/carreras/?departamento_id=abc")
        self.assertEqual(resp.status_code, 200)

    def test_intento_de_inyeccion_no_rompe_nada(self):
        resp = self.client.get("/api/v1/laboratorios/equipos/?laboratorio_id=1%20OR%201=1")
        self.assertEqual(resp.status_code, 200)

    def test_un_id_valido_sigue_filtrando(self):
        resp = self.client.get(
            f"{BASE}/departamentos/?unidad_academica_id={self.ua.pk}")
        self.assertEqual(resp.status_code, 200)
        datos = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(datos), 0)  # esta unidad no tiene departamentos
