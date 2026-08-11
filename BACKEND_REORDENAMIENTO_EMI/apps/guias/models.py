# App: guias | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear el modelo 'Guia' para gestionar prácticas de laboratorio.
# Debe heredar del BaseModel abstracto (created_at, updated_at).
#
# Campos del modelo 'Guia':
# - titulo: CharField(200)
# - codigo_interno: CharField(30) UNIQUE
# - numero_practica: SmallIntegerField (número dentro de la asignatura, ej: 1, 2, 3...)
# - asignatura: ForeignKey('estructura_academica.Asignatura', on_delete=PROTECT)
# - portada_url: URLField(max_length=500) - URL de la imagen JPG/PNG en S3
#   (blank=True, se puede generar automáticamente del PDF)
# - pdf_url: URLField(max_length=500) - URL del PDF en S3 (NOT NULL)
# - estado: CharField con choices:
#   BORRADOR='borrador', PENDIENTE='pendiente', APROBADO='aprobado', PUBLICADO='publicado'
#   default='borrador'
# - resolucion_numero: CharField(50) null=True blank=True
#   (REQUERIDO para poder publicar - es el candado institucional)
# - aprobado_por: ForeignKey('usuarios.Usuario', null=True, blank=True,
#   on_delete=SET_NULL, related_name='guias_aprobadas')
# - motivo_rechazo: TextField blank=True (para cuando la autoridad rechaza)
# - unique_together: (asignatura, numero_practica) - no puede haber dos práctica 3 en la misma materia
#
# Métodos del modelo:
# - puede_publicarse(): retorna True si resolucion_numero is not None and estado == 'aprobado'
# - es_visible_para_estudiantes(): retorna True si estado == 'publicado'
# - __str__: retorna "Práctica {numero} - {asignatura.nombre}"
#
# Meta: ordering = ['asignatura', 'numero_practica'], verbose_name_plural = 'Guías'

from django.db import models

from apps.estructura_academica.models import BaseModel


class Guia(BaseModel):
    titulo = models.CharField(max_length=200)
    codigo_interno = models.CharField(max_length=30, unique=True)
    numero_practica = models.SmallIntegerField()
    asignatura = models.ForeignKey(
        "estructura_academica.Asignatura",
        on_delete=models.PROTECT,
        related_name="guias",
    )
    portada_url = models.URLField(max_length=500, blank=True)
    # El PDF se sube al servidor. `pdf_url` se conserva para las guías que
    # todavía viven en un enlace externo y como respaldo cuando no hay archivo;
    # `GuiaSerializer.pdf_url` devuelve la URL del archivo si existe.
    pdf_archivo = models.FileField(
        upload_to="guias/pdf/",
        blank=True,
        null=True,
        verbose_name="Archivo PDF de la guía",
        help_text="PDF de la guía de laboratorio alojado en el servidor.",
    )
    pdf_url = models.URLField(
        max_length=500,
        blank=True,
        verbose_name="URL externa del PDF",
        help_text="Sólo para guías que aún no tienen el archivo subido.",
    )
    resolucion_numero = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        ordering = ["asignatura", "numero_practica"]
        verbose_name = "Guia"
        verbose_name_plural = "Guias"
        unique_together = (("asignatura", "numero_practica"),)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Práctica {self.numero_practica} - {self.asignatura.nombre}"

    def url_pdf(self, request=None):
        """URL utilizable del PDF: la del archivo subido, o la externa."""
        if self.pdf_archivo:
            url = self.pdf_archivo.url
            return request.build_absolute_uri(url) if request else url
        return self.pdf_url or ""
