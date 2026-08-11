"""
Management command: auditar_integridad
======================================
Comprueba las reglas que la base debe cumplir SIEMPRE, mire o no los Excel.

`auditar_carga` y `verificar_celdas` contrastan la base contra los documentos
oficiales. Esto es lo complementario: invariantes internos que no dependen del
origen de los datos y que, si se rompen, dejan la aplicación mostrando cifras
imposibles (un equipo que suma más unidades de las que tiene, un laboratorio
colgado de sí mismo, un bien que no pertenece a ninguna sede…).

Cada regla se comprueba por separado y se informa con ejemplos, para poder
arreglarla sin tener que salir a buscar los casos.

Uso:
    python manage.py auditar_integridad
    python manage.py auditar_integridad --detalle
"""

from django.core.management.base import BaseCommand
from django.db.models import F, Q


class Command(BaseCommand):
    help = "Comprueba los invariantes internos de la base de datos."

    def add_arguments(self, parser):
        parser.add_argument("--detalle", action="store_true")

    def handle(self, *args, **opt):
        from apps.estructura_academica.models import (
            Asignatura,
            Carrera,
            Departamento,
            UnidadAcademica,
        )
        from apps.guias.models import Guia
        from apps.usuarios.models import Usuario
        from apps.laboratorios.models import (
            Equipo,
            Laboratorio,
            TipoEquipo,
            UsoAcademico,
        )

        detalle = opt["detalle"]
        reglas = []

        def regla(nombre, queryset, muestra=lambda o: str(o)):
            """Registra una regla; el queryset son las filas que la INCUMPLEN."""
            fallos = list(queryset[:2000])
            reglas.append((nombre, len(fallos), [muestra(o) for o in fallos[:5]]))

        eq = lambda o: f"{o.codigo_activo} · {o.nombre[:34]}"          # noqa: E731
        lab = lambda o: f"{o.nombre[:40]} ({o.unidad_academica_id})"    # noqa: E731

        # ── Equipos: aritmética de cantidades ────────────────────────────
        regla("las cantidades suman el total",
              Equipo.objects.exclude(
                  cantidad_total=F("cantidad_buena") + F("cantidad_regular") + F("cantidad_mala")),
              eq)
        regla("no hay cantidades negativas",
              Equipo.objects.filter(
                  Q(cantidad_total__lt=0) | Q(cantidad_buena__lt=0)
                  | Q(cantidad_regular__lt=0) | Q(cantidad_mala__lt=0)), eq)
        regla("el estatus coincide con la cantidad marcada",
              Equipo.objects.filter(
                  Q(estatus_general="bueno", cantidad_buena=0)
                  | Q(estatus_general="regular", cantidad_regular=0)
                  | Q(estatus_general="malo", cantidad_mala=0)), eq)
        regla("todo equipo tiene código",
              Equipo.objects.filter(Q(codigo_activo="") | Q(codigo_activo__isnull=True)), eq)
        regla("todo equipo tiene nombre",
              Equipo.objects.filter(nombre=""), eq)

        # ── Equipos: pertenencia ─────────────────────────────────────────
        regla("todo equipo pertenece a una unidad académica",
              Equipo.objects.filter(unidad_academica__isnull=True), eq)
        hojas = {l.pk for l in Laboratorio.objects.all() if l.es_hoja()}
        regla("los equipos cuelgan de un nodo hoja",
              Equipo.objects.filter(laboratorio__isnull=False).exclude(laboratorio_id__in=hojas),
              eq)
        regla("la sede del equipo es la de su laboratorio",
              Equipo.objects.filter(laboratorio__isnull=False).exclude(
                  unidad_academica_id=F("laboratorio__unidad_academica_id")), eq)
        regla("el tipo asignado existe y está activo",
              Equipo.objects.filter(tipo__isnull=False, tipo__activo=False), eq)

        # ── Laboratorios: jerarquía ──────────────────────────────────────
        regla("todo laboratorio tiene unidad académica",
              Laboratorio.objects.filter(unidad_academica__isnull=True), lab)
        regla("ningún nodo es su propio padre",
              Laboratorio.objects.filter(parent_id=F("id")), lab)
        regla("el subespacio comparte sede con su padre",
              Laboratorio.objects.filter(parent__isnull=False).exclude(
                  unidad_academica_id=F("parent__unidad_academica_id")), lab)
        regla("las raíces son GENERAL y los hijos SUBESPACIO",
              Laboratorio.objects.filter(
                  Q(parent__isnull=True, clase_nodo="SUBESPACIO")
                  | Q(parent__isnull=False, clase_nodo="GENERAL")), lab)
        regla("la superficie declarada es positiva",
              Laboratorio.objects.filter(superficie_m2__lte=0), lab)
        regla("ningún laboratorio se llama igual que un hermano",
              self._hermanos_repetidos(Laboratorio), lab)

        # ciclos en la jerarquía (padre → abuelo → … → él mismo)
        ciclos = []
        padres = dict(Laboratorio.objects.values_list("id", "parent_id"))
        for nodo in padres:
            visto, actual = set(), nodo
            while actual is not None:
                if actual in visto:
                    ciclos.append(nodo)
                    break
                visto.add(actual)
                actual = padres.get(actual)
        reglas.append(("la jerarquía no tiene ciclos", len(ciclos),
                       [str(c) for c in ciclos[:5]]))

        # ── Estructura académica ─────────────────────────────────────────
        regla("toda carrera pertenece a un departamento",
              Carrera.objects.filter(departamento__isnull=True), lambda o: o.nombre)
        regla("toda asignatura tiene carrera y semestre",
              Asignatura.objects.filter(
                  Q(carrera__isnull=True) | Q(semestre__isnull=True)), lambda o: o.nombre)
        regla("los códigos de unidad académica no se repiten",
              self._repetidos(UnidadAcademica, "codigo"), lambda o: f"{o.codigo} · {o.nombre}")
        regla("los códigos de departamento no se repiten",
              self._repetidos(Departamento, "codigo"), lambda o: f"{o.codigo} · {o.nombre}")

        # ── Usos académicos y guías ──────────────────────────────────────
        regla("todo uso académico nombra una asignatura",
              UsoAcademico.objects.filter(asignatura=""), lambda o: str(o.pk))
        regla("toda guía tiene su PDF cargado",
              Guia.objects.filter(Q(pdf_archivo="") | Q(pdf_archivo__isnull=True)),
              lambda o: o.titulo[:40])
        regla("toda guía tiene asignatura",
              Guia.objects.filter(asignatura__isnull=True), lambda o: o.titulo[:40])

        # ── Catálogo de tipos ────────────────────────────────────────────
        regla("los tipos de equipo no se repiten",
              self._repetidos(TipoEquipo, "nombre"), lambda o: o.nombre)

        # ── Cuentas ──────────────────────────────────────────────────────
        # Una cuenta sin carné no puede iniciar sesión (el login es por CI) y
        # aparece como una fila en blanco en el panel de administración.
        regla("toda cuenta tiene carné de identidad",
              Usuario.objects.filter(Q(carnet_identidad="") | Q(carnet_identidad__isnull=True)),
              lambda o: f"id={o.pk} · rol {o.rol} · activa={o.is_active}")
        regla("toda cuenta tiene nombre",
              Usuario.objects.filter(nombre_completo=""),
              lambda o: f"id={o.pk} · {o.carnet_identidad or 'sin CI'} · rol {o.rol}")

        # ── Informe ──────────────────────────────────────────────────────
        ancho = 92
        self.stdout.write("\n" + "═" * ancho)
        self.stdout.write(self.style.SUCCESS("INVARIANTES DE LA BASE DE DATOS"))
        self.stdout.write("═" * ancho)
        rotos = 0
        for nombre, n, ejemplos in reglas:
            icono = "✅" if n == 0 else "❌"
            self.stdout.write(f"{icono} {nombre:<70}{'ok' if n == 0 else f'{n} filas':>18}")
            if n:
                rotos += 1
                if detalle:
                    for e in ejemplos:
                        self.stdout.write(self.style.WARNING(f"       {e}"))
        self.stdout.write("─" * ancho)
        if rotos == 0:
            self.stdout.write(self.style.SUCCESS(
                f"✅ {len(reglas)} invariantes comprobados, ninguno roto"))
        else:
            self.stdout.write(self.style.ERROR(
                f"❌ {rotos} de {len(reglas)} invariantes rotos"))
            if not detalle:
                self.stdout.write("   Ejecuta con --detalle para ver ejemplos.")
        self.stdout.write("═" * ancho + "\n")

    def _repetidos(self, modelo, campo):
        """Filas cuyo `campo` aparece más de una vez."""
        from django.db.models import Count

        valores = (modelo.objects.values(campo).annotate(n=Count("id"))
                   .filter(n__gt=1).values_list(campo, flat=True))
        return modelo.objects.filter(**{f"{campo}__in": list(valores)})

    def _hermanos_repetidos(self, modelo):
        """Nodos que comparten nombre, padre y sede (lo que prohíbe el índice)."""
        from django.db.models import Count
        from django.db.models.functions import Upper

        claves = (modelo.objects.annotate(n_up=Upper("nombre"))
                  .values("n_up", "parent_id", "unidad_academica_id")
                  .annotate(n=Count("id")).filter(n__gt=1))
        ids = []
        for c in claves:
            ids += list(modelo.objects.annotate(n_up=Upper("nombre")).filter(
                n_up=c["n_up"], parent_id=c["parent_id"],
                unidad_academica_id=c["unidad_academica_id"]).values_list("id", flat=True))
        return modelo.objects.filter(id__in=ids)
