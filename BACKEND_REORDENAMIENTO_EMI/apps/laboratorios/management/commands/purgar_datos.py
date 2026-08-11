"""
Management command: purgar_datos
=================================
Deja la base lista para una carga limpia desde los Excel oficiales.

Borra TODOS los datos operativos (laboratorios, equipos, guías, estructura
académica, movimientos) y CONSERVA usuarios y credenciales:

  Conserva  →  usuarios.Usuario, usuarios.AuditLog, auth.Group/Permission,
               sessions.Session, contenttypes, configuracion.ConfiguracionSistema
  Borra     →  todo lo demás

`Usuario.unidad_academica` es SET_NULL, así que la referencia se pierde al
borrar las unidades. El comando guarda el par (carnet → código de UA) en un
JSON para poder reasignarlo después de resembrar la estructura académica
(ver `--guardar-ua`, que se escribe por defecto en backups/).

Uso:
    python manage.py purgar_datos --dry-run     # muestra qué borraría
    python manage.py purgar_datos --confirmar   # ejecuta
"""

import json
import os
from datetime import datetime

from django.apps import apps as django_apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection, transaction

# Orden de borrado: de las hojas del grafo de FKs hacia la raíz, para no
# chocar con los on_delete=PROTECT (Equipo→Laboratorio, Asignatura→Carrera…).
ORDEN_BORRADO = [
    "laboratorios.EquipoRequeridoPorGuia",
    "guias.Guia",
    "evaluaciones.Evaluacion",
    "mantenimientos.RegistroMantenimiento",
    "reordenamiento.Reordenamiento",
    "notificaciones.Notificacion",
    "reactivos.Insumo",
    "laboratorios.Equipo",
    "laboratorios.UsoAcademico",
    "laboratorios.LaboratorioAsignatura",
    "laboratorios.TipoEquipo",
    "laboratorios.Laboratorio",
    "estructura_academica.Asignatura",
    "estructura_academica.Semestre",
    "estructura_academica.CarreraUnidadAcademica",
    "estructura_academica.Carrera",
    "estructura_academica.DepartamentoUnidadAcademica",
    "estructura_academica.Departamento",
    "estructura_academica.UnidadAcademica",
    "admin.LogEntry",
]

# Laboratorio tiene un FK a sí mismo con on_delete=SET_NULL: al borrar por ORM,
# Django primero pone parent=NULL en los hijos y esos hijos huérfanos chocan
# entre sí contra `uq_lab_raiz_nombre_ua`. Como vaciamos la tabla entera, el
# DELETE crudo evita ese paso intermedio.
BORRADO_CRUDO = {"laboratorios.Laboratorio"}

CONSERVADOS = [
    "usuarios.Usuario",
    "usuarios.AuditLog",
    "auth.Group",
    "auth.Permission",
    "sessions.Session",
    "contenttypes.ContentType",
    "configuracion.ConfiguracionSistema",
]


class Command(BaseCommand):
    help = "Borra los datos operativos conservando usuarios y credenciales."

    def add_arguments(self, parser):
        parser.add_argument("--confirmar", action="store_true",
                            help="Ejecuta el borrado (sin esta bandera es dry-run).")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--guardar-ua", default=None,
                            help="Ruta del JSON con el mapa carnet→código de UA.")

    def handle(self, *args, **opt):
        dry = opt["dry_run"] or not opt["confirmar"]

        Usuario = django_apps.get_model("usuarios", "Usuario")

        # ── Mapa carnet → código de UA (se pierde al borrar las unidades) ────
        mapa_ua = {}
        for u in Usuario.objects.select_related("unidad_academica"):
            if u.unidad_academica_id:
                mapa_ua[u.carnet_identidad] = u.unidad_academica.codigo

        destino = opt["guardar_ua"] or os.path.join(
            settings.BASE_DIR, "backups",
            f"usuarios_ua_{datetime.now():%Y%m%d_%H%M%S}.json",
        )

        self.stdout.write("\n" + "═" * 78)
        self.stdout.write(self.style.WARNING(
            f"PURGA DE DATOS {'(DRY-RUN — no se borra nada)' if dry else '(REAL)'}"))
        self.stdout.write("═" * 78)

        self.stdout.write("\nSe CONSERVAN:")
        for label in CONSERVADOS:
            modelo = django_apps.get_model(*label.split("."))
            self.stdout.write(f"   ✓ {label:46} {modelo.objects.count():>7}")

        self.stdout.write("\nSe BORRAN:")
        total = 0
        conteos = []
        for label in ORDEN_BORRADO:
            modelo = django_apps.get_model(*label.split("."))
            n = modelo.objects.count()
            conteos.append((label, modelo, n))
            total += n
            self.stdout.write(f"   ✗ {label:46} {n:>7}")
        self.stdout.write("─" * 78)
        self.stdout.write(f"   {'TOTAL registros a borrar':48} {total:>7}")

        if mapa_ua:
            self.stdout.write(
                f"\n📌 {len(mapa_ua)} usuario(s) con unidad académica; mapa → {destino}")

        if dry:
            self.stdout.write(self.style.WARNING(
                "\n⚠ DRY-RUN. Vuelve a ejecutar con --confirmar para aplicar.\n"))
            return

        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "w", encoding="utf-8") as fh:
            json.dump(mapa_ua, fh, ensure_ascii=False, indent=2)

        with transaction.atomic():
            for label, modelo, n in conteos:
                if not n:
                    continue
                if label in BORRADO_CRUDO:
                    with connection.cursor() as cur:
                        cur.execute(f'DELETE FROM "{modelo._meta.db_table}"')
                        borrados = cur.rowcount
                else:
                    borrados, _ = modelo.objects.all().delete()
                self.stdout.write(f"   🗑  {label:46} {borrados:>7}")

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Purga completada. Usuarios conservados: {Usuario.objects.count()}\n"))
