# App: reordenamiento | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear el modelo 'Reordenamiento' que registra el movimiento oficial
# de equipos entre laboratorios (puede ser entre sedes diferentes).
# Hereda de BaseModel (created_at, updated_at).
#
# Campos:
# - equipo: ForeignKey('laboratorios.Equipo', on_delete=PROTECT, related_name='reordenamientos')
# - laboratorio_origen: ForeignKey('laboratorios.Laboratorio', on_delete=PROTECT,
#   related_name='reordenamientos_origen')
# - laboratorio_destino: ForeignKey('laboratorios.Laboratorio', on_delete=PROTECT,
#   related_name='reordenamientos_destino')
# - cantidad_trasladada: IntegerField (validar > 0)
# - motivo: TextField blank=True
# - resolucion_numero: CharField(50) NOT NULL (CANDADO: sin resolución no hay reordenamiento)
# - estado: CharField choices:
#   PENDIENTE='pendiente', AUTORIZADO='autorizado',
#   EJECUTADO='ejecutado', CANCELADO='cancelado'
#   default='pendiente'
# - autorizado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='reordenamientos_autorizados')
# - ejecutado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='reordenamientos_ejecutados')
# - pdf_reporte_url: URLField(500) blank=True (URL del PDF generado en S3)
# - fecha_autorizacion: DateTimeField null=True
# - fecha_ejecucion: DateTimeField null=True
#
# Métodos:
# - clean(): validar que laboratorio_origen != laboratorio_destino
# - clean(): validar que cantidad_trasladada <= equipo.cantidad_disponible()
# - es_inter_sede(): retorna True si origen y destino son de diferente unidad_academica
# - __str__: "Reordenamiento #{id} - {equipo.nombre}: {origen} → {destino}"
#
# Meta: ordering = ['-created_at'], verbose_name_plural = 'Reordenamientos'

from django.db import models

# Create your models here.
