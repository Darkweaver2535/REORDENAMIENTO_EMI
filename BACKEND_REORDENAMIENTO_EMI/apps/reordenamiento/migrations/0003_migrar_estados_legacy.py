"""
Migración de datos: aplica valores por defecto a registros legacy de Reordenamiento.

Cambios:
  1. estado='ejecutado' → estado='recepcionado'
  2. estado='autorizado' → estado='aprobado'
  3. estado='pendiente'  → estado='pendiente_aprobacion'
  4. tipo_movimiento='' / NULL → tipo_movimiento='REASIGNACION_DEFINITIVA'
  5. resolucion_numero → numero_documento (si numero_documento está vacío)
"""

from django.db import migrations


def migrar_datos_legacy(apps, schema_editor):
    Reordenamiento = apps.get_model("reordenamiento", "Reordenamiento")

    # 1. EJECUTADO → RECEPCIONADO
    Reordenamiento.objects.filter(estado="ejecutado").update(estado="recepcionado")

    # 2. AUTORIZADO → APROBADO
    Reordenamiento.objects.filter(estado="autorizado").update(estado="aprobado")

    # 3. PENDIENTE → PENDIENTE_APROBACION
    Reordenamiento.objects.filter(estado="pendiente").update(estado="pendiente_aprobacion")

    # 4. tipo_movimiento vacío → REASIGNACION_DEFINITIVA
    Reordenamiento.objects.filter(tipo_movimiento="").update(
        tipo_movimiento="REASIGNACION_DEFINITIVA"
    )
    Reordenamiento.objects.filter(tipo_movimiento__isnull=True).update(
        tipo_movimiento="REASIGNACION_DEFINITIVA"
    )

    # 5. numero_documento vacío → copiar desde resolucion_numero
    for reord in Reordenamiento.objects.filter(numero_documento=""):
        if reord.resolucion_numero:
            reord.numero_documento = reord.resolucion_numero
            reord.save(update_fields=["numero_documento"])


def revertir_datos_legacy(apps, schema_editor):
    Reordenamiento = apps.get_model("reordenamiento", "Reordenamiento")

    # Revertir solo los estados clave; los demás son irreversibles sin snapshot
    Reordenamiento.objects.filter(estado="recepcionado").update(estado="ejecutado")
    Reordenamiento.objects.filter(estado="aprobado").update(estado="autorizado")
    Reordenamiento.objects.filter(estado="pendiente_aprobacion").update(estado="pendiente")


class Migration(migrations.Migration):

    dependencies = [
        ("reordenamiento", "0002_tipo_movimiento_y_campos_nuevos"),
    ]

    operations = [
        migrations.RunPython(migrar_datos_legacy, revertir_datos_legacy),
    ]
