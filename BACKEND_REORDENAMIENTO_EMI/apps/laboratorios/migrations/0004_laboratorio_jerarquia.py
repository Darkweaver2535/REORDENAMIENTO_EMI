# Migración 0004 — Jerarquía padre-hijo en Laboratorio
# Compatible con datos existentes: todos los campos nuevos tienen default/null.
# La FK Equipo.laboratorio NO se modifica — sin riesgo a registros existentes.
#
# Cambios:
#   - Laboratorio.parent      → FK self, null/blank, SET_NULL
#   - Laboratorio.clase_nodo  → CharField choices GENERAL/SUBESPACIO, default GENERAL
#   - Laboratorio.subtipo_espacio → CharField choices SALA/AREA/SECCION/LABORATORIO, null/blank
#   - Laboratorio.superficie_m2   → DecimalField, null/blank
#   - Laboratorio.ubicacion       → CharField, blank
#   - Laboratorio.norma           → CharField, blank
#   - Laboratorio.actividad_pea          → TextField, blank
#   - Laboratorio.actividad_investigacion → TextField, blank
#   - Laboratorio.actividad_servicios     → TextField, blank
#   - Laboratorio.sala → AlterField para hacer blank=True (antes era required)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('laboratorios', '0003_equipo_requiere_mantenimiento'),
    ]

    operations = [
        # ── FK auto-referencial (jerarquía padre-hijo) ────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hijos',
                to='laboratorios.laboratorio',
                verbose_name='Espacio padre',
            ),
        ),

        # ── clase_nodo ───────────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='clase_nodo',
            field=models.CharField(
                choices=[('GENERAL', 'General (raíz)'), ('SUBESPACIO', 'Subespacio (hijo)')],
                default='GENERAL',
                help_text='GENERAL para raíces; SUBESPACIO para nodos hijo.',
                max_length=20,
                verbose_name='Clase de nodo',
            ),
        ),

        # ── subtipo_espacio ──────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='subtipo_espacio',
            field=models.CharField(
                blank=True,
                choices=[
                    ('SALA', 'Sala'),
                    ('AREA', 'Área'),
                    ('SECCION', 'Sección'),
                    ('LABORATORIO', 'Laboratorio'),
                ],
                help_text='Obligatorio para nodos SUBESPACIO; nulo para nodos GENERAL.',
                max_length=20,
                null=True,
                verbose_name='Subtipo de espacio',
            ),
        ),

        # ── superficie_m2 ────────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='superficie_m2',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=8,
                null=True,
                verbose_name='Superficie (m²)',
            ),
        ),

        # ── ubicacion ────────────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='ubicacion',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Descripción textual de la ubicación física (ej: "Bloque B, planta baja").',
                max_length=255,
                verbose_name='Ubicación',
            ),
            preserve_default=False,
        ),

        # ── norma ────────────────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='norma',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Norma de bioseguridad, calidad o reglamento institucional.',
                max_length=255,
                verbose_name='Norma aplicable',
            ),
            preserve_default=False,
        ),

        # ── actividad_pea ────────────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='actividad_pea',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Actividades de enseñanza-aprendizaje realizadas en este espacio.',
                verbose_name='Actividad PEA',
            ),
            preserve_default=False,
        ),

        # ── actividad_investigacion ──────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='actividad_investigacion',
            field=models.TextField(
                blank=True,
                default='',
                verbose_name='Actividad de Investigación',
            ),
            preserve_default=False,
        ),

        # ── actividad_servicios ──────────────────────────────────────────────
        migrations.AddField(
            model_name='laboratorio',
            name='actividad_servicios',
            field=models.TextField(
                blank=True,
                default='',
                verbose_name='Actividad de Servicios',
            ),
            preserve_default=False,
        ),

        # ── sala → hacer blank=True (era required en migración 0001) ─────────
        migrations.AlterField(
            model_name='laboratorio',
            name='sala',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
