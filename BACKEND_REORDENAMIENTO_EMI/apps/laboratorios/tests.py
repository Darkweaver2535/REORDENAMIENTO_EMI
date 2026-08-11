"""Tests de subida de foto (#11), catálogo TipoEquipo (#12) y modelo unidad (#13)."""

import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

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


@override_settings(CACHES=CACHE_IN_MEMORY)
class FiltrosInventarioTests(TestCase):
    """Filtros de los listados de laboratorios y equipos.

    `EquipoViewSet` no tenía filtro por sede: pedir los equipos de una unidad
    devolvía el inventario completo de la EMI y el frontend acababa filtrando
    en memoria. `LaboratorioViewSet` sólo leía `unidad_id`, así que la página de
    evaluación in situ —que envía `unidad_academica_id`— veía todas las sedes.
    """

    @classmethod
    def setUpTestData(cls):
        cls.lapaz = UnidadAcademica.objects.create(
            nombre="UALP", ciudad="La Paz", codigo="0001")
        cls.tropico = UnidadAcademica.objects.create(
            nombre="UAT", ciudad="Trópico", codigo="0005")

        cls.lab_lp = Laboratorio.objects.create(
            nombre="QUÍMICA", unidad_academica=cls.lapaz, campus="Irpavi")
        cls.lab_tr = Laboratorio.objects.create(
            nombre="FÍSICA", unidad_academica=cls.tropico, campus="Trópico")

        for i in range(3):
            Equipo.objects.create(
                nombre=f"BALANZA {i}", codigo_activo=f"LP-{i}",
                laboratorio=cls.lab_lp, unidad_academica=cls.lapaz,
                cantidad_total=1, cantidad_buena=1)
        Equipo.objects.create(
            nombre="MICROSCOPIO", codigo_activo="TR-1",
            laboratorio=cls.lab_tr, unidad_academica=cls.tropico,
            cantidad_total=1, cantidad_buena=1)
        # Activo del padrón contable todavía sin laboratorio asignado.
        Equipo.objects.create(
            nombre="AGITADOR SIN UBICAR", codigo_activo="LP-SIN",
            laboratorio=None, unidad_academica=cls.lapaz,
            cantidad_total=1, cantidad_regular=1)

        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="34343434", password="x",
            nombre_completo="Admin", rol="ADMIN")

    def setUp(self):
        self.client = _client_as(self.admin)

    def _codigos(self, url):
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        datos = resp.data
        filas = datos["results"] if isinstance(datos, dict) and "results" in datos else datos
        return sorted(f["codigo_activo"] for f in filas)

    def test_equipos_filtran_por_unidad_academica(self):
        url = f"/api/v1/laboratorios/equipos/?unidad_academica_id={self.tropico.pk}"
        self.assertEqual(self._codigos(url), ["TR-1"])

    def test_equipos_aceptan_el_alias_unidad_id(self):
        url = f"/api/v1/laboratorios/equipos/?unidad_id={self.tropico.pk}"
        self.assertEqual(self._codigos(url), ["TR-1"])

    def test_equipos_filtran_por_laboratorio(self):
        url = f"/api/v1/laboratorios/equipos/?laboratorio_id={self.lab_tr.pk}"
        self.assertEqual(self._codigos(url), ["TR-1"])

    def test_equipos_sin_laboratorio_asignado(self):
        url = "/api/v1/laboratorios/equipos/?sin_laboratorio=true"
        self.assertEqual(self._codigos(url), ["LP-SIN"])

    def test_equipos_sin_filtro_devuelven_todo(self):
        self.assertEqual(len(self._codigos("/api/v1/laboratorios/equipos/?page_size=100")), 5)

    def test_laboratorios_aceptan_unidad_academica_id(self):
        """La evaluación in situ envía este nombre; antes se ignoraba."""
        resp = self.client.get(
            f"/api/v1/laboratorios/?unidad_academica_id={self.tropico.pk}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        filas = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual([f["nombre"] for f in filas], ["FÍSICA"])

    def test_laboratorios_siguen_aceptando_unidad_id(self):
        resp = self.client.get(f"/api/v1/laboratorios/?unidad_id={self.lapaz.pk}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        filas = resp.data["results"] if "results" in resp.data else resp.data
        self.assertEqual([f["nombre"] for f in filas], ["QUÍMICA"])


@override_settings(CACHES=CACHE_IN_MEMORY)
class AltaEquipoTests(TestCase):
    """Alta de equipos desde el inventario.

    El asistente de reordenamiento remite a "Inventario → Equipos → Nuevo
    equipo"; el formulario no existía aunque la API sí lo soportaba.
    """

    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(nombre="UAT", ciudad="Trópico", codigo="0005")
        cls.lab = Laboratorio.objects.create(nombre="QUÍMICA", unidad_academica=cls.ua, campus="X")
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="66660001", password="x", nombre_completo="Admin", rol="ADMIN")
        cls.estudiante = Usuario.objects.create_user(
            carnet_identidad="66660002", password="x", nombre_completo="Est", rol="ESTUDIANTE")

    def setUp(self):
        self.client = _client_as(self.admin)

    def _payload(self, **extra):
        base = {
            "nombre": "MICROSCOPIO NUEVO", "codigo_activo": "9-00001",
            "estatus_general": "bueno", "cantidad_total": 1,
            "cantidad_buena": 1, "cantidad_regular": 0, "cantidad_mala": 0,
            "laboratorio_id": self.lab.pk,
        }
        base.update(extra)
        return base

    def test_crea_equipo_y_hereda_la_unidad_del_laboratorio(self):
        resp = self.client.post("/api/v1/laboratorios/equipos/", self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        eq = Equipo.objects.get(codigo_activo="9-00001")
        self.assertEqual(eq.laboratorio, self.lab)
        self.assertEqual(eq.unidad_academica, self.ua)
        self.assertEqual((eq.cantidad_buena, eq.cantidad_total), (1, 1))

    def test_crea_equipo_sin_laboratorio_si_hay_unidad(self):
        """Un activo del padrón puede entrar sin ubicación asignada."""
        resp = self.client.post("/api/v1/laboratorios/equipos/", self._payload(
            codigo_activo="9-00002", laboratorio_id=None, unidad_academica_id=self.ua.pk),
            format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertIsNone(Equipo.objects.get(codigo_activo="9-00002").laboratorio)

    def test_rechaza_codigo_duplicado(self):
        self.client.post("/api/v1/laboratorios/equipos/", self._payload(), format="json")
        resp = self.client.post("/api/v1/laboratorios/equipos/", self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("codigo_activo", resp.data)

    def test_rechaza_cantidad_mayor_a_uno(self):
        resp = self.client.post("/api/v1/laboratorios/equipos/", self._payload(
            codigo_activo="9-00003", cantidad_total=5, cantidad_buena=5), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cantidad_total", resp.data)

    def test_estudiante_no_puede_crear(self):
        self.client = _client_as(self.estudiante)
        resp = self.client.post("/api/v1/laboratorios/equipos/", self._payload(
            codigo_activo="9-00004"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class CantidadesImposiblesTests(TestCase):
    """Las cantidades de un equipo tienen que ser posibles.

    La API aceptaba un POST con cantidades negativas y devolvía 201. A partir de
    ahí el inventario quedaba corrupto en silencio: el total de equipos, el
    porcentaje de operativos y la comparativa por sede se calculan sumando estos
    campos, y ninguna pantalla delataba de dónde venía el desajuste.
    """

    @classmethod
    def setUpTestData(cls):
        cls.ua = UnidadAcademica.objects.create(
            nombre="UA Cant", ciudad="X", codigo="CANT1", abreviacion="CANT")
        cls.lab = Laboratorio.objects.create(
            nombre="Lab Cant", unidad_academica=cls.ua, campus="C")
        cls.encargado = Usuario.objects.create_user(
            carnet_identidad="82000001", password="x", nombre_completo="Enc",
            rol="ENCARGADO_ACTIVOS", unidad_academica=cls.ua)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.encargado)

    def _crear(self, **extra):
        payload = {
            "nombre": "Equipo de prueba",
            "codigo_activo": extra.pop("codigo", "CANT-001"),
            "unidad_academica_id": self.ua.pk,
            "laboratorio_id": self.lab.pk,
            "estatus_general": "bueno",
            "cantidad_total": 1,
            "cantidad_buena": 1,
            "cantidad_regular": 0,
            "cantidad_mala": 0,
        }
        payload.update(extra)
        return self.client.post("/api/v1/laboratorios/equipos/", payload, format="json")

    def test_alta_valida_sigue_funcionando(self):
        self.assertEqual(self._crear().status_code, 201)

    def test_rechaza_cantidad_negativa(self):
        resp = self._crear(codigo="CANT-NEG", cantidad_buena=-3, cantidad_total=-3)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cantidad_buena", resp.data)

    def test_rechaza_total_que_no_es_la_suma(self):
        resp = self._crear(codigo="CANT-SUM", cantidad_total=9)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cantidad_total", resp.data)

    def test_ninguna_alta_invalida_llega_a_la_base(self):
        self._crear(codigo="CANT-X1", cantidad_mala=-1, cantidad_total=0)
        self._crear(codigo="CANT-X2", cantidad_total=7)
        self.assertFalse(Equipo.objects.filter(codigo_activo__startswith="CANT-X").exists())

    def test_editar_otro_campo_no_exige_reenviar_las_cantidades(self):
        self._crear(codigo="CANT-EDIT")
        equipo = Equipo.objects.get(codigo_activo="CANT-EDIT")
        resp = self.client.patch(
            f"/api/v1/laboratorios/equipos/{equipo.pk}/",
            {"notas": "Revisado en inventario"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)


class EquipoEnNodoHojaTests(APITestCase):
    """Un equipo se guarda en el ambiente concreto donde está.

    Los laboratorios generales agrupan salas, áreas y secciones. Al aceptar uno
    de esos contenedores, el equipo quedaba colgado de un nodo que la interfaz
    no lista como destino: desaparecía del árbol y no contaba en el recuento de
    ningún ambiente. El formulario ya filtraba los nodos hoja, pero la API no.
    """

    @classmethod
    def setUpTestData(cls):
        cls.unidad = UnidadAcademica.objects.create(
            nombre="UA Hoja", ciudad="La Paz", codigo="0091", abreviacion="UAH")
        cls.general = Laboratorio.objects.create(
            nombre="QUÍMICA", unidad_academica=cls.unidad, campus="Central")
        cls.sala = Laboratorio.objects.create(
            nombre="QUÍMICA APLICADA", parent=cls.general,
            unidad_academica=cls.unidad, campus="Central")
        cls.suelto = Laboratorio.objects.create(
            nombre="FÍSICA", unidad_academica=cls.unidad, campus="Central")
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="60000001", password="x",
            nombre_completo="Admin", rol="ADMIN")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _crear(self, laboratorio, codigo):
        return self.client.post("/api/v1/laboratorios/equipos/", {
            "nombre": "Microscopio", "codigo_activo": codigo,
            "laboratorio_id": laboratorio.pk,
            "cantidad_total": 1, "cantidad_buena": 1,
            "estatus_general": "bueno",
        }, format="json")

    def test_rechaza_un_laboratorio_que_agrupa_subespacios(self):
        resp = self._crear(self.general, "EQ-HOJA-1")
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("laboratorio_id", resp.data)

    def test_el_mensaje_sugiere_los_subespacios(self):
        resp = self._crear(self.general, "EQ-HOJA-2")
        self.assertIn("QUÍMICA APLICADA", str(resp.data["laboratorio_id"]))

    def test_acepta_un_subespacio(self):
        resp = self._crear(self.sala, "EQ-HOJA-3")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_acepta_un_laboratorio_sin_subespacios(self):
        """Un nodo raíz sin hijos también es una hoja: ahí sí hay equipos."""
        resp = self._crear(self.suelto, "EQ-HOJA-4")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_no_se_puede_mover_un_equipo_a_un_contenedor(self):
        self._crear(self.sala, "EQ-HOJA-5")
        equipo = Equipo.objects.get(codigo_activo="EQ-HOJA-5")
        resp = self.client.patch(f"/api/v1/laboratorios/equipos/{equipo.pk}/", {
            "laboratorio_id": self.general.pk}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)


class ArbolSinConsultasPorNodoTests(APITestCase):
    """El árbol se arma con un número fijo de consultas, no una por nodo.

    El serializer preguntaba `hijos.exists()` dos veces por nodo —para saber si
    es hoja y para decidir si recurre— y sacaba el nombre de la sede de cada
    hijo por separado, ignorando la precarga. Con 169 laboratorios eso eran 129
    consultas; el coste crecía con el inventario.
    """

    @classmethod
    def setUpTestData(cls):
        cls.unidad = UnidadAcademica.objects.create(
            nombre="UA Árbol", ciudad="La Paz", codigo="0092", abreviacion="UAA")
        # Tres raíces, cada una con tres salas y una de ellas con dos áreas.
        for i in range(3):
            raiz = Laboratorio.objects.create(
                nombre=f"GENERAL {i}", unidad_academica=cls.unidad, campus="C")
            for j in range(3):
                sala = Laboratorio.objects.create(
                    nombre=f"SALA {i}-{j}", parent=raiz,
                    unidad_academica=cls.unidad, campus="C")
                if j == 0:
                    for k in range(2):
                        Laboratorio.objects.create(
                            nombre=f"ÁREA {i}-{j}-{k}", parent=sala,
                            unidad_academica=cls.unidad, campus="C")
        cls.admin = Usuario.objects.create_superuser(
            carnet_identidad="61000001", password="x",
            nombre_completo="Admin", rol="ADMIN")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_el_numero_de_consultas_no_depende_del_tamano_del_arbol(self):
        """Una consulta por nivel de profundidad, ninguna por nodo."""
        with CaptureQueriesContext(connection) as antes:
            self.client.get("/api/v1/laboratorios/tree/")

        # Se triplica el número de nodos sin añadir profundidad.
        for i in range(3, 12):
            raiz = Laboratorio.objects.create(
                nombre=f"GENERAL {i}", unidad_academica=self.unidad, campus="C")
            for j in range(3):
                Laboratorio.objects.create(
                    nombre=f"SALA {i}-{j}", parent=raiz,
                    unidad_academica=self.unidad, campus="C")

        with CaptureQueriesContext(connection) as despues:
            resp = self.client.get("/api/v1/laboratorios/tree/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(antes.captured_queries), len(despues.captured_queries),
                         "el número de consultas creció con el número de nodos")
        self.assertLessEqual(len(despues.captured_queries), 6)

    def test_devuelve_el_arbol_completo(self):
        datos = self.client.get("/api/v1/laboratorios/tree/").data

        def contar(nodos):
            return sum(1 + contar(n["hijos"]) for n in nodos)

        self.assertEqual(len(datos), 3)          # raíces
        self.assertEqual(contar(datos), 18)      # 3 + 9 + 6

    def test_marca_bien_las_hojas(self):
        datos = self.client.get("/api/v1/laboratorios/tree/").data
        hojas, ramas = [], []

        def recorrer(nodos):
            for n in nodos:
                (hojas if n["es_hoja"] else ramas).append(n["nombre"])
                recorrer(n["hijos"])

        recorrer(datos)
        # Hojas: las 6 áreas y las 6 salas sin áreas.
        self.assertEqual(len(hojas), 12)
        self.assertTrue(all(n.startswith(("ÁREA", "SALA")) for n in hojas))
        self.assertTrue(all(n.startswith(("GENERAL", "SALA")) for n in ramas))

    def test_cada_nodo_trae_el_nombre_de_su_sede(self):
        datos = self.client.get("/api/v1/laboratorios/tree/").data
        nombres = []

        def recorrer(nodos):
            for n in nodos:
                nombres.append(n["unidad_academica_nombre"])
                recorrer(n["hijos"])

        recorrer(datos)
        self.assertTrue(all(n == "UA Árbol" for n in nombres), nombres[:5])
