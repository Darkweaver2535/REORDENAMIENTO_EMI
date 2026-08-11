"""Tests del alcance del dashboard por rol.

El dashboard es la portada del sistema y resume el mismo inventario que se
consulta en el resto de las pantallas, así que debe respetar la regla de
visibilidad (#15). Antes no lo hacía: devolvía las cifras nacionales a
cualquier usuario autenticado y las servía desde una única clave de caché, de
modo que un estudiante leía "3364 equipos" en la portada mientras el listado de
equipos le salía vacío, y el primero en pedir el dashboard fijaba lo que veían
todos los demás.
"""

from rest_framework.test import APIClient, APITestCase

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio
from apps.usuarios.models import Usuario

URL = "/api/v1/dashboard/metricas/"


class AlcanceDelDashboardTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.lapaz = UnidadAcademica.objects.create(
            nombre="UALP", abreviacion="UALP", ciudad="La Paz", codigo="0001")
        cls.cbba = UnidadAcademica.objects.create(
            nombre="UACB", abreviacion="UACB", ciudad="Cochabamba", codigo="0002")

        cls.lab_lp = Laboratorio.objects.create(
            nombre="QUÍMICA", unidad_academica=cls.lapaz, campus="Irpavi")
        cls.lab_cb = Laboratorio.objects.create(
            nombre="FÍSICA", unidad_academica=cls.cbba, campus="Cala Cala")

        for i in range(3):
            Equipo.objects.create(
                nombre=f"Equipo LP {i}", codigo_activo=f"LP-{i}",
                laboratorio=cls.lab_lp, unidad_academica=cls.lapaz,
                cantidad_total=1, cantidad_buena=1, estatus_general="bueno")
        Equipo.objects.create(
            nombre="Equipo CB", codigo_activo="CB-0",
            laboratorio=cls.lab_cb, unidad_academica=cls.cbba,
            cantidad_total=1, cantidad_mala=1, estatus_general="malo")

        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="70000001", password="x",
            nombre_completo="Admin", rol="ADMIN")
        cls.jefe = Usuario.objects.create_user(
            carnet_identidad="70000002", password="x",
            nombre_completo="Jefe", rol="JEFE")
        cls.encargado = Usuario.objects.create_user(
            carnet_identidad="70000003", password="x",
            nombre_completo="Encargado", rol="ENCARGADO_ACTIVOS",
            unidad_academica=cls.lapaz)
        cls.estudiante = Usuario.objects.create_user(
            carnet_identidad="70000004", password="x",
            nombre_completo="Estudiante", rol="ESTUDIANTE")

    def _metricas(self, usuario):
        cliente = APIClient()
        cliente.force_authenticate(user=usuario)
        resp = cliente.get(URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        return resp.data

    def test_admin_ve_el_inventario_nacional(self):
        self.assertEqual(self._metricas(self.admin)["total_equipos"], 4)

    def test_jefe_ve_el_inventario_nacional(self):
        self.assertEqual(self._metricas(self.jefe)["total_equipos"], 4)

    def test_encargado_ve_solo_su_sede(self):
        datos = self._metricas(self.encargado)
        self.assertEqual(datos["total_equipos"], 3)
        self.assertEqual([s["sede"] for s in datos["equipos_por_sede"]], ["UALP"])

    def test_estudiante_no_ve_inventario(self):
        datos = self._metricas(self.estudiante)
        self.assertEqual(datos["total_equipos"], 0)
        self.assertEqual(datos["equipos_por_sede"], [])
        self.assertEqual(datos["laboratorios_activos"], 0)

    def test_la_cache_no_mezcla_lo_que_ve_cada_rol(self):
        """El primero en pedirlo no debe fijar la respuesta de los demás."""
        self.assertEqual(self._metricas(self.admin)["total_equipos"], 4)
        self.assertEqual(self._metricas(self.estudiante)["total_equipos"], 0)
        self.assertEqual(self._metricas(self.encargado)["total_equipos"], 3)
        self.assertEqual(self._metricas(self.admin)["total_equipos"], 4)

    def test_las_guias_y_el_catalogo_siguen_siendo_de_todos(self):
        """Guías y tipos son catálogo institucional, no inventario."""
        for usuario in (self.admin, self.estudiante):
            datos = self._metricas(usuario)
            self.assertIn("total_guias_publicadas", datos)
            self.assertIn("total_tipos_equipo", datos)
