"""Tests del flujo completo de reordenamiento."""

from io import BytesIO

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.estructura_academica.models import UnidadAcademica
from apps.laboratorios.models import Equipo, Laboratorio
from apps.notificaciones.models import Notificacion
from apps.reordenamiento.models import Reordenamiento
from apps.reordenamiento.services import ReordenamientoService
from apps.usuarios.models import Usuario

CACHE_IN_MEMORY = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


def _ua(nombre="UA Reo", codigo="URTST"):
    return UnidadAcademica.objects.create(
        nombre=nombre, ciudad="Ciudad", codigo=codigo, abreviacion=codigo, is_active=True
    )


def _lab(ua, nombre="Lab", campus="Campus"):
    return Laboratorio.objects.create(
        nombre=nombre, unidad_academica=ua, campus=campus, capacidad_estudiantes=10
    )


def _equipo(lab, codigo="EQ-T001", buena=1, regular=0, mala=0):
    t = buena + regular + mala
    return Equipo.objects.create(
        nombre="Equipo Test",
        codigo_activo=codigo,
        laboratorio=lab,
        unidad_academica=lab.unidad_academica,
        cantidad_total=t,
        cantidad_buena=buena,
        cantidad_regular=regular,
        cantidad_mala=mala,
    )


def _usuario(carnet, rol, ua=None):
    u = Usuario.objects.create(
        carnet_identidad=carnet, nombre_completo=f"User {carnet}", rol=rol, unidad_academica=ua
    )
    u.set_password("test1234")
    u.save(update_fields=["password"])
    return u


def _client_as(u):
    c = APIClient()
    c.force_authenticate(user=u)
    return c


def _pdf():
    b = BytesIO(b"%PDF-1.4 x")
    b.name = "doc.pdf"
    b.content_type = "application/pdf"
    b.size = 11
    return b


@override_settings(CACHES=CACHE_IN_MEMORY)
class FlujReordenamientoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua = _ua()
        cls.origen = _lab(cls.ua, "Origen Lab", "Campus O")
        cls.destino = _lab(cls.ua, "Destino Lab", "Campus D")
        cls.eq = _equipo(cls.origen, "EQ-FLOW-01")
        cls.admin = _usuario("ADM_FL", Usuario.Rol.ADMIN, cls.ua)
        cls.jefe = _usuario("JEF_FL", Usuario.Rol.JEFE, cls.ua)
        cls.encargado = _usuario("ENC_FL", Usuario.Rol.ENCARGADO_ACTIVOS, cls.ua)
        cls.estudiante = _usuario("EST_FL", Usuario.Rol.ESTUDIANTE, cls.ua)
        cls.enc_activos = _usuario("ENC_ACT", Usuario.Rol.ENCARGADO_ACTIVOS, cls.ua)

    def setUp(self):
        cache.clear()

    def test_estudiante_no_puede_crear(self):
        r = _client_as(self.estudiante).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "REASIGNACION_DEFINITIVA",
                "equipo_id": self.eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 403)

    def test_admin_crea_reasignacion_exitosamente(self):
        eq = _equipo(self.origen, "EQ-CR-01")
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "REASIGNACION_DEFINITIVA",
                "equipo_id": eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
                "numero_documento": "RES-001",
                "documento_respaldo": _pdf(),
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["estado"], Reordenamiento.Estado.PENDIENTE_APROBACION)

    def test_reasignacion_sin_numero_documento_rechazada(self):
        eq = _equipo(self.origen, "EQ-CR-02")
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "REASIGNACION_DEFINITIVA",
                "equipo_id": eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
                "documento_respaldo": _pdf(),
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)

    def test_reasignacion_sin_pdf_rechazada(self):
        eq = _equipo(self.origen, "EQ-CR-03")
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "REASIGNACION_DEFINITIVA",
                "equipo_id": eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
                "numero_documento": "RES-002",
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)

    def test_flujo_completo_reasignacion(self):
        eq = _equipo(self.origen, "EQ-FULL-01")
        reo = ReordenamientoService.crear_movimiento(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo_id=eq.id,
            lab_origen_id=self.origen.id,
            lab_destino_id=self.destino.id,
            cantidad=1,
            numero_documento="RES-FULL",
            usuario_solicitante=self.admin,
        )
        self.assertEqual(reo.estado, Reordenamiento.Estado.PENDIENTE_APROBACION)
        reo = ReordenamientoService.aprobar(reo.id, self.admin)
        self.assertEqual(reo.estado, Reordenamiento.Estado.APROBADO)
        reo = ReordenamientoService.marcar_en_transito(reo.id, self.encargado)
        self.assertEqual(reo.estado, Reordenamiento.Estado.EN_TRANSITO)
        reo = ReordenamientoService.recepcionar(reo.id, self.encargado, "OK")
        self.assertEqual(reo.estado, Reordenamiento.Estado.RECEPCIONADO)

    def test_encargado_no_puede_aprobar(self):
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=self.eq,
            laboratorio_origen=self.origen,
            laboratorio_destino=self.destino,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.PENDIENTE_APROBACION,
        )
        r = _client_as(self.encargado).post(
            f"/api/v1/reordenamientos/{reo.id}/aprobar/", {}, format="json"
        )
        self.assertEqual(r.status_code, 403)

    def test_jefe_puede_aprobar(self):
        eq = _equipo(self.origen, "EQ-APR-01")
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.origen,
            laboratorio_destino=self.destino,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.PENDIENTE_APROBACION,
        )
        r = _client_as(self.jefe).post(
            f"/api/v1/reordenamientos/{reo.id}/aprobar/", {}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["estado"], Reordenamiento.Estado.APROBADO)

    def test_recepcion_completa_mueve_registro_intacto(self):
        """FIX #11: traslado completo solo cambia laboratorio."""
        eq = _equipo(self.origen, "EQ-REC-01", buena=1)
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.origen,
            laboratorio_destino=self.destino,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.EN_TRANSITO,
        )
        ReordenamientoService.recepcionar(reo.id, self.encargado)
        eq.refresh_from_db()
        self.assertEqual(eq.laboratorio_id, self.destino.id)
        self.assertEqual(eq.cantidad_total, 1)
        self.assertEqual(eq.cantidad_buena, 1)

    def test_recepcion_parcial_divide_lote_correctamente(self):
        """FIX #11: traslado parcial → 2 registros con invariante."""
        eq = _equipo(self.origen, "EQ-SPLIT-01", buena=3, regular=1, mala=1)
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.origen,
            laboratorio_destino=self.destino,
            cantidad_trasladada=2,
            estado=Reordenamiento.Estado.EN_TRANSITO,
        )
        ReordenamientoService.recepcionar(reo.id, self.encargado)
        eq.refresh_from_db()
        self.assertEqual(eq.cantidad_total, 3)
        self.assertEqual(
            eq.cantidad_total, eq.cantidad_buena + eq.cantidad_regular + eq.cantidad_mala
        )
        self.assertEqual(eq.laboratorio_id, self.origen.id)
        nuevo = (
            Equipo.objects.filter(laboratorio_id=self.destino.id, nombre=eq.nombre)
            .exclude(id=eq.id)
            .first()
        )
        self.assertIsNotNone(nuevo)
        self.assertEqual(nuevo.cantidad_total, 2)
        self.assertEqual(
            nuevo.cantidad_total,
            nuevo.cantidad_buena + nuevo.cantidad_regular + nuevo.cantidad_mala,
        )

    def test_notificacion_al_aprobar(self):
        """FIX #5: ENCARGADO_ACTIVOS recibe notificación al aprobar."""
        Notificacion.objects.filter(usuario=self.enc_activos).delete()
        eq = _equipo(self.origen, "EQ-NOTIF-01")
        reo = ReordenamientoService.crear_movimiento(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo_id=eq.id,
            lab_origen_id=self.origen.id,
            lab_destino_id=self.destino.id,
            cantidad=1,
            numero_documento="RES-N01",
            usuario_solicitante=self.admin,
        )
        ReordenamientoService.aprobar(reo.id, self.admin)
        self.assertGreater(Notificacion.objects.filter(usuario=self.enc_activos).count(), 0)

    def test_notificacion_al_recepcionar(self):
        """FIX #5: ENCARGADO_ACTIVOS recibe notificación al recepcionar."""
        eq = _equipo(self.origen, "EQ-NOTIF-02")
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.origen,
            laboratorio_destino=self.destino,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.EN_TRANSITO,
        )
        Notificacion.objects.filter(usuario=self.enc_activos).delete()
        ReordenamientoService.recepcionar(reo.id, self.encargado)
        self.assertGreater(Notificacion.objects.filter(usuario=self.enc_activos).count(), 0)


@override_settings(CACHES=CACHE_IN_MEMORY)
class FlujCompraTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua = _ua("UA Compra", "UCMPR")
        cls.destino = _lab(cls.ua, "Lab Compra", "Campus C")
        cls.admin = _usuario("ADM_CM", Usuario.Rol.ADMIN, cls.ua)
        cls.encargado = _usuario("ENC_CM", Usuario.Rol.ENCARGADO_ACTIVOS, cls.ua)

    def setUp(self):
        cache.clear()

    def test_compra_acepta_cantidad_mayor_a_disponible(self):
        """FIX #10: COMPRA con disponible=0 pasa validación."""
        eq = Equipo.objects.create(
            nombre="Eq Sin Lab",
            codigo_activo="EQ-COMPRA-01",
            laboratorio=None,
            unidad_academica=self.ua,
            cantidad_total=0,
            cantidad_buena=0,
            cantidad_regular=0,
            cantidad_mala=0,
        )
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "COMPRA",
                "equipo_id": eq.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 5,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)

    def test_recepcion_compra_asigna_destino(self):
        eq = Equipo.objects.create(
            nombre="Eq Compra R",
            codigo_activo="EQ-COMPRA-02",
            laboratorio=None,
            unidad_academica=self.ua,
            cantidad_total=0,
            cantidad_buena=0,
            cantidad_regular=0,
            cantidad_mala=0,
        )
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.COMPRA,
            equipo=eq,
            laboratorio_destino=self.destino,
            cantidad_trasladada=3,
            estado=Reordenamiento.Estado.EN_TRANSITO,
        )
        ReordenamientoService.recepcionar(reo.id, self.encargado)
        eq.refresh_from_db()
        self.assertEqual(eq.laboratorio_id, self.destino.id)


@override_settings(CACHES=CACHE_IN_MEMORY)
class FlujPrestamoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua = _ua("UA Prestamo", "UPLST")
        cls.origen = _lab(cls.ua, "Lab Origen P", "Campus P")
        cls.destino = _lab(cls.ua, "Lab Destino P", "Campus P2")
        cls.eq = _equipo(cls.origen, "EQ-PREST-01")
        cls.admin = _usuario("ADM_PR", Usuario.Rol.ADMIN, cls.ua)

    def setUp(self):
        cache.clear()

    def test_prestamo_sin_fecha_retorno_rechazado(self):
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "PRESTAMO",
                "equipo_id": self.eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("fecha_retorno_prevista", str(r.data))

    def test_prestamo_con_fecha_retorno_aceptado(self):
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "PRESTAMO",
                "equipo_id": self.eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 1,
                "fecha_retorno_prevista": "2026-12-31",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)

    def test_prestamo_rechaza_cantidad_mayor_disponible(self):
        """FIX #10: PRESTAMO sí valida stock (al contrario que COMPRA)."""
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "PRESTAMO",
                "equipo_id": self.eq.id,
                "laboratorio_origen_id": self.origen.id,
                "laboratorio_destino_id": self.destino.id,
                "cantidad_trasladada": 999,
                "fecha_retorno_prevista": "2026-12-31",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)


@override_settings(CACHES=CACHE_IN_MEMORY)
class ReglasNegocioTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ua = _ua("UA Reglas", "URGLS")
        cls.lab1 = _lab(cls.ua, "Lab R1", "Campus R")
        cls.lab2 = _lab(cls.ua, "Lab R2", "Campus R2")
        cls.admin = _usuario("ADM_RG", Usuario.Rol.ADMIN, cls.ua)
        cls.encargado = _usuario("ENC_RG", Usuario.Rol.ENCARGADO_ACTIVOS, cls.ua)

    def setUp(self):
        cache.clear()

    def test_no_se_puede_aprobar_ya_aprobado(self):
        eq = _equipo(self.lab1, "EQ-RG-01")
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.lab1,
            laboratorio_destino=self.lab2,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.APROBADO,
        )
        with self.assertRaises(ValidationError):
            ReordenamientoService.aprobar(reo.id, self.admin)

    def test_no_se_puede_ejecutar_sin_aprobacion_previa(self):
        eq = _equipo(self.lab1, "EQ-RG-02")
        reo = Reordenamiento.objects.create(
            tipo_movimiento=Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA,
            equipo=eq,
            laboratorio_origen=self.lab1,
            laboratorio_destino=self.lab2,
            cantidad_trasladada=1,
            estado=Reordenamiento.Estado.PENDIENTE_APROBACION,
        )
        with self.assertRaises(ValidationError):
            ReordenamientoService.marcar_en_transito(reo.id, self.encargado)

    def test_origen_igual_destino_rechazado(self):
        eq = _equipo(self.lab1, "EQ-RG-03")
        r = _client_as(self.admin).post(
            "/api/v1/reordenamientos/",
            {
                "tipo_movimiento": "REASIGNACION_DEFINITIVA",
                "equipo_id": eq.id,
                "laboratorio_origen_id": self.lab1.id,
                "laboratorio_destino_id": self.lab1.id,
                "cantidad_trasladada": 1,
                "numero_documento": "RES-XYZ",
                "documento_respaldo": _pdf(),
            },
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)


@override_settings(CACHES=CACHE_IN_MEMORY)
class SedeDelEquipoTrasElMovimientoTests(TestCase):
    """Un equipo pertenece a la sede de su laboratorio.

    Al recepcionar un traslado se cambiaba `laboratorio` pero no
    `unidad_academica`, así que un movimiento entre sedes dejaba el bien
    físicamente en el destino y contabilizado en el origen: todas las cifras por
    unidad académica —el dashboard, la comparativa de sedes, el alcance del
    ENCARGADO_ACTIVOS— quedaban mal justo después del movimiento que el sistema
    existe para gestionar. En el traslado parcial era peor: el registro nuevo se
    creaba sin unidad académica ninguna.
    """

    @classmethod
    def setUpTestData(cls):
        cls.origen_ua = _ua("UA Origen", "UAORI")
        cls.destino_ua = _ua("UA Destino", "UADES")
        cls.origen = _lab(cls.origen_ua, "Lab Origen")
        cls.destino = _lab(cls.destino_ua, "Lab Destino")
        cls.aprobador = _usuario("81000001", "ADMIN")

    def _mover(self, equipo, cantidad, tipo=None):
        tipo = tipo or Reordenamiento.TipoMovimiento.REASIGNACION_DEFINITIVA
        mov = ReordenamientoService.crear_movimiento(
            tipo_movimiento=tipo,
            equipo_id=equipo.id,
            lab_origen_id=self.origen.id,
            lab_destino_id=self.destino.id,
            cantidad=cantidad,
            numero_documento="RES-001/2026",
            usuario_solicitante=self.aprobador,
        )
        ReordenamientoService.aprobar(mov.id, self.aprobador)
        ReordenamientoService.recepcionar(mov.id, self.aprobador)
        return mov

    def test_traslado_completo_cambia_la_sede_del_equipo(self):
        equipo = _equipo(self.origen, "EQ-SEDE-1", buena=1)
        self._mover(equipo, 1)

        equipo.refresh_from_db()
        self.assertEqual(equipo.laboratorio_id, self.destino.id)
        self.assertEqual(equipo.unidad_academica_id, self.destino_ua.id)

    def test_traslado_parcial_crea_el_registro_en_la_sede_destino(self):
        equipo = _equipo(self.origen, "EQ-SEDE-2", buena=3)
        self._mover(equipo, 1)

        equipo.refresh_from_db()
        # El remanente no se mueve de sede.
        self.assertEqual(equipo.unidad_academica_id, self.origen_ua.id)
        self.assertEqual(equipo.cantidad_total, 2)

        nuevo = Equipo.objects.get(laboratorio=self.destino)
        self.assertEqual(nuevo.unidad_academica_id, self.destino_ua.id)
        self.assertEqual(nuevo.cantidad_total, 1)

    def test_ningun_equipo_queda_sin_unidad_academica(self):
        equipo = _equipo(self.origen, "EQ-SEDE-3", buena=2)
        self._mover(equipo, 1)

        self.assertFalse(Equipo.objects.filter(unidad_academica__isnull=True).exists())

    def test_la_compra_tambien_deja_el_equipo_en_la_sede_destino(self):
        equipo = _equipo(self.origen, "EQ-SEDE-4", buena=1)
        self._mover(equipo, 1, tipo=Reordenamiento.TipoMovimiento.COMPRA)

        equipo.refresh_from_db()
        self.assertEqual(equipo.laboratorio_id, self.destino.id)
        self.assertEqual(equipo.unidad_academica_id, self.destino_ua.id)

    def test_los_conteos_por_sede_cuadran_tras_el_movimiento(self):
        """Es la cifra que enseñan el dashboard y la comparativa de sedes."""
        equipo = _equipo(self.origen, "EQ-SEDE-5", buena=1)
        self._mover(equipo, 1)

        self.assertEqual(Equipo.objects.filter(unidad_academica=self.origen_ua).count(), 0)
        self.assertEqual(Equipo.objects.filter(unidad_academica=self.destino_ua).count(), 1)
        # Y coincide con lo que dice el laboratorio donde está.
        self.assertEqual(
            Equipo.objects.filter(laboratorio__unidad_academica=self.destino_ua).count(),
            Equipo.objects.filter(unidad_academica=self.destino_ua).count(),
        )
