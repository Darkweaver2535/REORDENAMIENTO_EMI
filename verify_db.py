#!/usr/bin/env python
"""Verificación completa de la base de datos antes de importación Excel."""
import os, sys, django
from datetime import datetime
from collections import Counter

sys.path.append(os.path.abspath('BACKEND_REORDENAMIENTO_EMI'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db.models import Q, F, Count, Sum
from apps.estructura_academica.models import (
    UnidadAcademica, Departamento, DepartamentoUnidadAcademica,
    Carrera, CarreraUnidadAcademica, Semestre, Asignatura,
)
from apps.laboratorios.models import Laboratorio, Equipo, EquipoRequeridoPorGuia
from apps.guias.models import Guia
from apps.usuarios.models import Usuario
from apps.reordenamiento.models import Reordenamiento

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print(f"=== VERIFICACIÓN DE BD — {now} ===")
print()

# ═══════════════════════════════════════════════════════════════
# [ESTRUCTURA ACADÉMICA]
# ═══════════════════════════════════════════════════════════════
print("[ESTRUCTURA ACADÉMICA]")

ua_count = UnidadAcademica.objects.count()
dep_count = Departamento.objects.count()
car_count = Carrera.objects.count()
sem_count = Semestre.objects.count()
asig_count = Asignatura.objects.count()

print(f"- UnidadAcademica: {ua_count} registros")
print(f"- Departamento: {dep_count} registros")
print(f"- Carrera: {car_count} registros")
print(f"- Semestre: {sem_count} registros")
print(f"- Asignatura: {asig_count} registros")

# Asignaturas sin semestre (FK obligatoria, pero verificar nulls en BD)
try:
    asig_sin_sem = Asignatura.objects.filter(semestre__isnull=True).count()
except Exception as e:
    asig_sin_sem = f"ERROR: {e}"
print(f"- Asignaturas sin semestre: {asig_sin_sem}")

# Asignaturas sin carrera (FK obligatoria, pero verificar)
try:
    asig_sin_car = Asignatura.objects.filter(carrera__isnull=True).count()
except Exception as e:
    asig_sin_car = f"ERROR: {e}"
print(f"- Asignaturas sin carrera: {asig_sin_car}")

# Carreras sin unidad académica vinculada (via M2M CarreraUnidadAcademica)
carreras_con_ua = set(CarreraUnidadAcademica.objects.values_list('carrera_id', flat=True))
carreras_sin_ua = Carrera.objects.exclude(id__in=carreras_con_ua).count()
print(f"- Carreras sin unidad académica (M2M): {carreras_sin_ua}")

# Departamentos sin UA (FK legacy es nullable)
dep_sin_ua_fk = Departamento.objects.filter(unidad_academica__isnull=True).count()
dep_con_ua_m2m = set(DepartamentoUnidadAcademica.objects.values_list('departamento_id', flat=True))
dep_sin_ua_m2m = Departamento.objects.exclude(id__in=dep_con_ua_m2m).count()
print(f"- Departamentos sin UA (FK legacy null): {dep_sin_ua_fk}")
print(f"- Departamentos sin UA (M2M): {dep_sin_ua_m2m}")

# Duplicados en nombres
dup_ua = (UnidadAcademica.objects.values('nombre').annotate(c=Count('id')).filter(c__gt=1))
dup_dep = (Departamento.objects.values('nombre').annotate(c=Count('id')).filter(c__gt=1))
dup_car = (Carrera.objects.values('nombre').annotate(c=Count('id')).filter(c__gt=1))
dup_asig = (Asignatura.objects.values('nombre', 'carrera_id').annotate(c=Count('id')).filter(c__gt=1))

duplicados = []
for d in dup_ua:
    duplicados.append(f"  UA duplicada: '{d['nombre']}' x{d['c']}")
for d in dup_dep:
    duplicados.append(f"  Depto duplicado: '{d['nombre']}' x{d['c']}")
for d in dup_car:
    duplicados.append(f"  Carrera duplicada: '{d['nombre']}' x{d['c']}")
for d in dup_asig:
    duplicados.append(f"  Asignatura duplicada: nombre='{d['nombre']}' carrera_id={d['carrera_id']} x{d['c']}")

if duplicados:
    print(f"- Duplicados detectados:")
    for dup in duplicados:
        print(f"  {dup}")
else:
    print(f"- Duplicados detectados: ninguno")

print()

# ═══════════════════════════════════════════════════════════════
# [LABORATORIOS Y EQUIPOS]
# ═══════════════════════════════════════════════════════════════
print("[LABORATORIOS Y EQUIPOS]")

lab_count = Laboratorio.objects.count()
eq_count = Equipo.objects.count()
print(f"- Laboratorios: {lab_count} registros")
print(f"- Equipos: {eq_count} registros")

lab_sin_ua = Laboratorio.objects.filter(unidad_academica__isnull=True).count()
print(f"- Laboratorios sin UnidadAcademica: {lab_sin_ua}")

eq_sin_lab = Equipo.objects.filter(laboratorio__isnull=True).count()
print(f"- Equipos sin Laboratorio: {eq_sin_lab}")

eq_total_zero = Equipo.objects.filter(cantidad_total=0).count()
print(f"- Equipos con cantidad_total = 0: {eq_total_zero}")

# Campos negativos
eq_neg = Equipo.objects.filter(
    Q(cantidad_total__lt=0) | Q(cantidad_buena__lt=0) | Q(cantidad_regular__lt=0) | Q(cantidad_mala__lt=0)
).count()
print(f"- Equipos con campos negativos: {eq_neg}")

# cantidad_buena + cantidad_regular + cantidad_mala != cantidad_total
eq_inconsistentes = Equipo.objects.exclude(
    cantidad_total=F('cantidad_buena') + F('cantidad_regular') + F('cantidad_mala')
).count()
print(f"- Equipos con cantidades inconsistentes (suma != total): {eq_inconsistentes}")
if eq_inconsistentes > 0:
    for eq in Equipo.objects.exclude(
        cantidad_total=F('cantidad_buena') + F('cantidad_regular') + F('cantidad_mala')
    )[:5]:
        print(f"    ID={eq.id} '{eq.nombre}': total={eq.cantidad_total}, b={eq.cantidad_buena} r={eq.cantidad_regular} m={eq.cantidad_mala} (suma={eq.cantidad_buena+eq.cantidad_regular+eq.cantidad_mala})")

# Códigos duplicados
dup_codigos = (Equipo.objects.values('codigo_activo').annotate(c=Count('id')).filter(c__gt=1))
if dup_codigos.exists():
    print(f"- Códigos de activo duplicados:")
    for d in dup_codigos:
        print(f"    '{d['codigo_activo']}' x{d['c']}")
else:
    print(f"- Códigos de activo duplicados: ninguno")

print()

# ═══════════════════════════════════════════════════════════════
# [GUÍAS]
# ═══════════════════════════════════════════════════════════════
print("[GUÍAS]")

guia_count = Guia.objects.count()
print(f"- Guías: {guia_count} registros")

guia_sin_asig = Guia.objects.filter(asignatura__isnull=True).count()
print(f"- Guías sin asignatura: {guia_sin_asig}")

guia_sin_pdf = Guia.objects.filter(Q(pdf_url__isnull=True) | Q(pdf_url='')).count()
print(f"- Guías sin PDF: {guia_sin_pdf}")

# numero_practica duplicado por asignatura (debería estar protegido por unique_together)
dup_practica = (
    Guia.objects.values('asignatura_id', 'numero_practica')
    .annotate(c=Count('id'))
    .filter(c__gt=1)
)
if dup_practica.exists():
    print(f"- Número de práctica duplicado por asignatura:")
    for d in dup_practica:
        print(f"    asignatura_id={d['asignatura_id']} practica={d['numero_practica']} x{d['c']}")
else:
    print(f"- Número de práctica duplicado por asignatura: ninguno")

eqr_invalido = EquipoRequeridoPorGuia.objects.filter(cantidad_requerida__lte=0).count()
print(f"- EquipoRequeridoPorGuia con cantidad = 0 o negativo: {eqr_invalido}")
eqr_total = EquipoRequeridoPorGuia.objects.count()
print(f"- EquipoRequeridoPorGuia total: {eqr_total}")

print()

# ═══════════════════════════════════════════════════════════════
# [USUARIOS]
# ═══════════════════════════════════════════════════════════════
print("[USUARIOS]")

roles = dict(Usuario.objects.values_list('rol').annotate(c=Count('id')).values_list('rol', 'c'))
admin_c = roles.get('ADMIN', 0)
jefe_c = roles.get('JEFE', 0)
docente_c = roles.get('DOCENTE', 0)
estudiante_c = roles.get('ESTUDIANTE', 0)
encargado_c = roles.get('ENCARGADO_ACTIVOS', 0)
otros = {k: v for k, v in roles.items() if k not in ('ADMIN', 'JEFE', 'DOCENTE', 'ESTUDIANTE', 'ENCARGADO_ACTIVOS')}
print(f"- ADMIN: {admin_c} | JEFE: {jefe_c} | DOCENTE: {docente_c} | ESTUDIANTE: {estudiante_c} | ENCARGADO_ACTIVOS: {encargado_c}")
if otros:
    print(f"- Roles no reconocidos: {otros}")

sin_ua_no_admin = Usuario.objects.filter(unidad_academica__isnull=True).exclude(rol='ADMIN').exclude(is_superuser=True).count()
print(f"- Sin unidad académica (no ADMIN, no superuser): {sin_ua_no_admin}")

dup_ci = (Usuario.objects.values('carnet_identidad').annotate(c=Count('id')).filter(c__gt=1))
if dup_ci.exists():
    print(f"- Carnet duplicado:")
    for d in dup_ci:
        print(f"    '{d['carnet_identidad']}' x{d['c']}")
else:
    print(f"- Carnet duplicado: ninguno")

print()

# ═══════════════════════════════════════════════════════════════
# [REORDENAMIENTOS]
# ═══════════════════════════════════════════════════════════════
print("[REORDENAMIENTOS]")

reord_count = Reordenamiento.objects.count()
print(f"- Total: {reord_count}")

origen_eq_destino = Reordenamiento.objects.filter(
    laboratorio_origen__isnull=False,
    laboratorio_destino__isnull=False,
    laboratorio_origen_id=F('laboratorio_destino_id')
).count()
print(f"- Origen = Destino: {origen_eq_destino}")

# FK rotas a equipos (equipo_id apunta a un Equipo que ya no existe)
# Django ORM con PROTECT debería impedirlo, pero verificamos
equipo_ids_reord = set(Reordenamiento.objects.values_list('equipo_id', flat=True))
equipo_ids_existentes = set(Equipo.objects.values_list('id', flat=True))
fk_rotas_eq = equipo_ids_reord - equipo_ids_existentes
print(f"- FK rotas a equipos: {len(fk_rotas_eq)}")
if fk_rotas_eq:
    print(f"    IDs huérfanos: {fk_rotas_eq}")

print()

# ═══════════════════════════════════════════════════════════════
# [INTEGRIDAD REFERENCIAL]
# ═══════════════════════════════════════════════════════════════
print("[INTEGRIDAD REFERENCIAL]")

fk_issues = []

# Equipo.laboratorio -> Laboratorio
eq_lab_ids = set(Equipo.objects.filter(laboratorio__isnull=False).values_list('laboratorio_id', flat=True))
lab_ids = set(Laboratorio.objects.values_list('id', flat=True))
orphan_eq_lab = eq_lab_ids - lab_ids
if orphan_eq_lab:
    fk_issues.append(f"Equipo.laboratorio apunta a Laboratorio inexistente: {orphan_eq_lab}")

# Guia.asignatura -> Asignatura
guia_asig_ids = set(Guia.objects.values_list('asignatura_id', flat=True))
asig_ids = set(Asignatura.objects.values_list('id', flat=True))
orphan_guia_asig = guia_asig_ids - asig_ids
if orphan_guia_asig:
    fk_issues.append(f"Guia.asignatura apunta a Asignatura inexistente: {orphan_guia_asig}")

# EquipoRequeridoPorGuia.equipo -> Equipo (nullable)
eqr_eq_ids = set(EquipoRequeridoPorGuia.objects.filter(equipo__isnull=False).values_list('equipo_id', flat=True))
orphan_eqr_eq = eqr_eq_ids - equipo_ids_existentes
if orphan_eqr_eq:
    fk_issues.append(f"EquipoRequeridoPorGuia.equipo apunta a Equipo inexistente: {orphan_eqr_eq}")

# EquipoRequeridoPorGuia.guia -> Guia
eqr_guia_ids = set(EquipoRequeridoPorGuia.objects.values_list('guia_id', flat=True))
guia_ids = set(Guia.objects.values_list('id', flat=True))
orphan_eqr_guia = eqr_guia_ids - guia_ids
if orphan_eqr_guia:
    fk_issues.append(f"EquipoRequeridoPorGuia.guia apunta a Guia inexistente: {orphan_eqr_guia}")

# Laboratorio.unidad_academica -> UnidadAcademica
lab_ua_ids = set(Laboratorio.objects.filter(unidad_academica__isnull=False).values_list('unidad_academica_id', flat=True))
ua_ids = set(UnidadAcademica.objects.values_list('id', flat=True))
orphan_lab_ua = lab_ua_ids - ua_ids
if orphan_lab_ua:
    fk_issues.append(f"Laboratorio.unidad_academica apunta a UA inexistente: {orphan_lab_ua}")

# Asignatura.carrera -> Carrera
asig_car_ids = set(Asignatura.objects.values_list('carrera_id', flat=True))
car_ids = set(Carrera.objects.values_list('id', flat=True))
orphan_asig_car = asig_car_ids - car_ids
if orphan_asig_car:
    fk_issues.append(f"Asignatura.carrera apunta a Carrera inexistente: {orphan_asig_car}")

# Asignatura.semestre -> Semestre
asig_sem_ids = set(Asignatura.objects.values_list('semestre_id', flat=True))
sem_ids = set(Semestre.objects.values_list('id', flat=True))
orphan_asig_sem = asig_sem_ids - sem_ids
if orphan_asig_sem:
    fk_issues.append(f"Asignatura.semestre apunta a Semestre inexistente: {orphan_asig_sem}")

# Carrera.departamento -> Departamento
car_dep_ids = set(Carrera.objects.values_list('departamento_id', flat=True))
dep_ids = set(Departamento.objects.values_list('id', flat=True))
orphan_car_dep = car_dep_ids - dep_ids
if orphan_car_dep:
    fk_issues.append(f"Carrera.departamento apunta a Departamento inexistente: {orphan_car_dep}")

if fk_issues:
    print(f"- FK huérfanas detectadas:")
    for issue in fk_issues:
        print(f"    {issue}")
else:
    print(f"- FK huérfanas detectadas: ninguna")

print()

# ═══════════════════════════════════════════════════════════════
# [RESUMEN]
# ═══════════════════════════════════════════════════════════════
print("[RESUMEN]")

criticos = []
advertencias = []

# Críticos
if fk_issues:
    criticos.append("FK huérfanas detectadas (integridad referencial rota)")
if fk_rotas_eq:
    criticos.append(f"Reordenamientos con FK rota a equipos: {fk_rotas_eq}")
if eq_neg > 0:
    criticos.append(f"{eq_neg} equipos con campos negativos")

# Advertencias
if eq_sin_lab > 0:
    advertencias.append(f"{eq_sin_lab} equipos sin laboratorio asignado (normal para COMPRA)")
if eq_total_zero > 0:
    advertencias.append(f"{eq_total_zero} equipos con cantidad_total = 0")
if eq_inconsistentes > 0:
    advertencias.append(f"{eq_inconsistentes} equipos con cantidades inconsistentes (suma != total)")
if carreras_sin_ua > 0:
    advertencias.append(f"{carreras_sin_ua} carreras sin vínculo M2M a unidad académica")
if dep_sin_ua_fk > 0:
    advertencias.append(f"{dep_sin_ua_fk} departamentos sin UA (FK legacy null)")
if sin_ua_no_admin > 0:
    advertencias.append(f"{sin_ua_no_admin} usuarios no-admin sin unidad académica")
if guia_sin_pdf > 0:
    advertencias.append(f"{guia_sin_pdf} guías sin PDF")
if eqr_invalido > 0:
    advertencias.append(f"{eqr_invalido} EquipoRequeridoPorGuia con cantidad <= 0")
if duplicados:
    advertencias.append(f"{len(duplicados)} nombres duplicados en estructura académica")
if lab_sin_ua > 0:
    advertencias.append(f"{lab_sin_ua} laboratorios sin unidad académica")

if criticos:
    estado = "CON ERRORES CRÍTICOS"
elif advertencias:
    estado = "CON ADVERTENCIAS"
else:
    estado = "OK"

print(f"- Estado general: {estado}")

print(f"- Problemas críticos (bloquean importación): ", end="")
if criticos:
    print()
    for c in criticos:
        print(f"    • {c}")
else:
    print("ninguno")

print(f"- Advertencias (no bloquean pero conviene revisar): ", end="")
if advertencias:
    print()
    for a in advertencias:
        print(f"    • {a}")
else:
    print("ninguno")

print(f"- Recomendación: {'CORREGIR ANTES DE IMPORTAR' if criticos else 'PROCEDER con precaución' if advertencias else 'PROCEDER'}")
