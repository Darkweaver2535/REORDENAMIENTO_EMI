"""
Tests de autenticación, permisos, throttling y scoping por rol.
"""

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio
from apps.reordenamiento.models import Reordenamiento
from apps.usuarios.models import AuditLog, Usuario

CACHE_IN_MEMORY = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def _ua(nombre="UA Test", codigo="UATST"):
    return UnidadAcademica.objects.create(
        nombre=nombre, ciudad="Ciudad Test", codigo=codigo, abreviacion=codigo, is_active=True
    )


def _lab(ua, nombre="Lab Test", campus="Campus Test"):
    return Laboratorio.objects.create(
        nombre=nombre, unidad_academica=ua, campus=campus, capacidad_estudiantes=20
    )


def _equipo(lab, codigo="COD-T001"):
    return Equipo.objects.create(
        nombre="Equipo Test",
        codigo_activo=codigo,
        laboratorio=lab,
        unidad_academica=lab.unidad_academica,
        cantidad_total=1,
        cantidad_buena=1,
        cantidad_regular=0,
        cantidad_mala=0,
    )


def _usuario(carnet, rol, ua=None, password="test1234"):
    u = Usuario.objects.create(
        carnet_identidad=carnet, nombre_completo=f"Usuario {carnet}", rol=rol, unidad_academica=ua
    )
    u.set_password(password)
    u.save(update_fields=["password"])
    return u


def _client_as(usuario):
    c = APIClient()
    c.force_authenticate(user=usuario)
    return c


@override_settings(CACHES=CACHE_IN_MEMORY)
class LoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.ua = _ua()
        self.admin = _usuario("ADMIN001", Usuario.Rol.ADMIN, self.ua)

    def _login(self, carnet, password="test1234", ip="127.0.0.1"):
        return self.client.post(
            "/api/v1/auth/login/",
            {"carnet_identidad": carnet, "password": password},
            format="json",
            REMOTE_ADDR=ip,
        )

    def test_login_exitoso_devuelve_campos_requeridos(self):
        resp = self._login("ADMIN001")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for campo in (
            "access_token",
            "refresh_token",
            "id",
            "carnet_identidad",
            "rol",
            "nombre_completo",
        ):
            self.assertIn(campo, resp.data, f"Falta: {campo}")
        self.assertEqual(resp.data["id"], self.admin.id)
        self.assertEqual(resp.data["carnet_identidad"], "ADMIN001")

    def test_login_credenciales_invalidas_retorna_401(self):
        resp = self._login("ADMIN001", "mal_pass", ip="10.0.1.1")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_carnet_inexistente_retorna_401(self):
        resp = self._login("NO_EXISTE", ip="10.0.1.2")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_sin_campos_retorna_400(self):
        resp = self.client.post("/api/v1/auth/login/", {}, format="json", REMOTE_ADDR="10.0.1.3")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usuario_inactivo_bloqueado(self):
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])
        resp = self._login("ADMIN001", ip="10.0.1.5")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(
    CACHES=CACHE_IN_MEMORY,
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
        "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
        "PAGE_SIZE": 20,
        "PAGE_SIZE_QUERY_PARAM": "page_size",
        "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
        "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
        "DEFAULT_THROTTLE_RATES": {"anon": "1000/min", "user": "1000/min", "login": "5/minute"},
    },
)
class LoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_sexto_intento_retorna_429(self):
        ip = "10.99.99.1"
        for i in range(5):
            r = self.client.post(
                "/api/v1/auth/login/",
                {"carnet_identidad": "X", "password": "x"},
                format="json",
                REMOTE_ADDR=ip,
            )
            self.assertIn(r.status_code, (400, 401), f"Intento {i + 1}: {r.status_code}")
        r = self.client.post(
            "/api/v1/auth/login/",
            {"carnet_identidad": "X", "password": "x"},
            format="json",
            REMOTE_ADDR=ip,
        )
        self.assertEqual(r.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(CACHES=CACHE_IN_MEMORY)
class ScopingInventarioTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua1 = _ua("Sede A", "UA1ST")
        cls.ua2 = _ua("Sede B", "UA2ST")
        cls.lab1 = _lab(cls.ua1, "Lab A1", "Campus A")
        cls.lab2 = _lab(cls.ua2, "Lab B1", "Campus B")
        cls.eq1 = _equipo(cls.lab1, "EQ-A-T01")
        cls.eq2 = _equipo(cls.lab2, "EQ-B-T01")
        cls.admin = _usuario("ADM_SC", Usuario.Rol.ADMIN, cls.ua1)
        cls.encargado = _usuario("ENC_SC", Usuario.Rol.ENCARGADO_ACTIVOS, cls.ua1)
        cls.encargado_sin_ua = _usuario("ENC_SIN", Usuario.Rol.ENCARGADO_ACTIVOS, ua=None)
        cls.estudiante = _usuario("EST_SC", Usuario.Rol.ESTUDIANTE, cls.ua1)

    def setUp(self):
        cache.clear()

    def test_admin_ve_todos_los_equipos(self):
        ids = {
            e["id"]
            for e in _client_as(self.admin).get("/api/v1/laboratorios/equipos/").data["results"]
        }
        self.assertIn(self.eq1.id, ids)
        self.assertIn(self.eq2.id, ids)

    def test_encargado_ve_solo_equipos_de_su_ua(self):
        ids = {
            e["id"]
            for e in _client_as(self.encargado).get("/api/v1/laboratorios/equipos/").data["results"]
        }
        self.assertIn(self.eq1.id, ids)
        self.assertNotIn(self.eq2.id, ids)

    def test_encargado_sin_ua_no_ve_equipos(self):
        self.assertEqual(
            _client_as(self.encargado_sin_ua).get("/api/v1/laboratorios/equipos/").data["count"], 0
        )

    def test_estudiante_no_ve_equipos(self):
        self.assertEqual(
            _client_as(self.estudiante).get("/api/v1/laboratorios/equipos/").data["count"], 0
        )

    def test_admin_ve_todos_los_laboratorios(self):
        ids = {
            lab["id"] for lab in _client_as(self.admin).get("/api/v1/laboratorios/").data["results"]
        }
        self.assertIn(self.lab1.id, ids)
        self.assertIn(self.lab2.id, ids)

    def test_encargado_ve_solo_labs_de_su_ua(self):
        ids = {
            lab["id"]
            for lab in _client_as(self.encargado).get("/api/v1/laboratorios/").data["results"]
        }
        self.assertIn(self.lab1.id, ids)
        self.assertNotIn(self.lab2.id, ids)

    def test_estudiante_no_ve_laboratorios(self):
        self.assertEqual(_client_as(self.estudiante).get("/api/v1/laboratorios/").data["count"], 0)

    def test_encargado_ve_reordenamientos_de_su_ua(self):
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=self.eq1,
            laboratorio_origen=self.lab1,
            laboratorio_destino=self.lab2,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.APROBADO,
        )
        ids = {
            r["id"]
            for r in _client_as(self.encargado).get("/api/v1/reordenamientos/").data["results"]
        }
        self.assertIn(reo.id, ids)

    def test_encargado_no_ve_reordenamientos_de_otra_ua(self):
        eq2b = _equipo(self.lab2, "EQ-B-T02")
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq2b,
            laboratorio_origen=self.lab2,
            laboratorio_destino=self.lab2,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.APROBADO,
        )
        ids = {
            r["id"]
            for r in _client_as(self.encargado).get("/api/v1/reordenamientos/").data["results"]
        }
        self.assertNotIn(reo.id, ids)


@override_settings(CACHES=CACHE_IN_MEMORY)
class DashboardRegressionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ua = _ua("UA Dash", "UADSH")
        cls.admin = _usuario("ADM_DASH", Usuario.Rol.ADMIN, ua)

    def setUp(self):
        cache.clear()

    def test_dashboard_retorna_200(self):
        self.assertEqual(_client_as(self.admin).get("/api/v1/dashboard/metricas/").status_code, 200)

    def test_dashboard_contiene_campos_esperados(self):
        resp = _client_as(self.admin).get("/api/v1/dashboard/metricas/")
        for campo in (
            "total_guias_publicadas",
            "total_equipos",
            "laboratorios_activos",
            "reordenamientos_pendientes",
            # Campos de decisión nuevos
            "equipos_operativos",
            "equipos_operativos_porcentaje",
            "equipos_sin_asignar",
            "total_tipos_equipo",
            "comparativa_unidades",
            "ranking_laboratorios_criticos",
            "tipos_mas_comunes",
            "reordenamientos_por_estado",
            "alertas",
        ):
            self.assertIn(campo, resp.data, f"Falta: {campo}")

    def test_dashboard_comparativa_refleja_equipos(self):
        """La comparativa por unidad agrupa los equipos creados."""
        ua = _ua("Sede Dash B", "SDBDS")
        lab = _lab(ua, "Lab Dash", "Campus")
        _equipo(lab, "EQ-DASH-1")
        _equipo(lab, "EQ-DASH-2")
        cache.clear()
        resp = _client_as(self.admin).get("/api/v1/dashboard/metricas/")
        comparativa = resp.data["comparativa_unidades"]
        fila = next((c for c in comparativa if c["sede"] == "SDBDS"), None)
        self.assertIsNotNone(fila)
        self.assertEqual(fila["total"], 2)


@override_settings(CACHES=CACHE_IN_MEMORY)
class AuditoriaEndpointTests(TestCase):
    """#10: la bitácora de auditoría ahora se puede consultar (ADMIN/JEFE)."""

    @classmethod
    def setUpTestData(cls):
        ua = _ua("UA Audit", "UADIT")
        cls.admin = _usuario("ADM_AUD", Usuario.Rol.ADMIN, ua)
        cls.jefe = _usuario("JEF_AUD", Usuario.Rol.JEFE, ua)
        cls.estudiante = _usuario("EST_AUD", Usuario.Rol.ESTUDIANTE, ua)
        AuditLog.objects.create(
            tabla_afectada="Usuario",
            registro_id=cls.admin.id,
            accion=AuditLog.Accion.LOGIN,
            usuario=cls.admin,
            ip_address="10.0.0.1",
        )
        AuditLog.objects.create(
            tabla_afectada="Reordenamiento",
            registro_id=1,
            accion=AuditLog.Accion.APPROVE,
            usuario=cls.admin,
        )

    def setUp(self):
        cache.clear()

    def test_admin_puede_listar_auditoria(self):
        resp = _client_as(self.admin).get("/api/v1/usuarios/auditoria/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 2)

    def test_jefe_puede_listar_auditoria(self):
        resp = _client_as(self.jefe).get("/api/v1/usuarios/auditoria/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_estudiante_no_puede_acceder(self):
        resp = _client_as(self.estudiante).get("/api/v1/usuarios/auditoria/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_filtro_por_accion(self):
        resp = _client_as(self.admin).get("/api/v1/usuarios/auditoria/?accion=APPROVE")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(all(r["accion"] == "APPROVE" for r in resp.data["results"]))

    def test_serializa_nombre_y_accion_display(self):
        resp = _client_as(self.admin).get("/api/v1/usuarios/auditoria/?accion=LOGIN")
        registro = resp.data["results"][0]
        self.assertIn("usuario_nombre", registro)
        self.assertIn("accion_display", registro)
        self.assertEqual(registro["accion_display"], "Inicio de sesion")
