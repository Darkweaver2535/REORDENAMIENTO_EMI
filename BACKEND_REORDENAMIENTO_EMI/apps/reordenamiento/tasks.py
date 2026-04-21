# App: reordenamiento | Archivo: tasks.py
# Sistema de gestión de laboratorios universitarios - Celery + Django
#
# TAREA: Crear tareas Celery para generación asíncrona de reportes PDF:
#
# 1. @shared_task generar_pdf_reordenamiento(reordenamiento_id):
#    - Obtener el objeto Reordenamiento con todos sus related (equipo, labs, usuarios)
#    - Renderizar template HTML a PDF usando WeasyPrint:
#      Template: 'reordenamiento/reporte_pdf.html'
#      Datos: equipo, origen, destino, cantidad, resolución, fecha, autorizador
#    - Subir el PDF generado a S3/MinIO en bucket 'reportes/reordenamientos/'
#      Nombre del archivo: f"reordenamiento_{reordenamiento_id}_{timestamp}.pdf"
#    - Actualizar campo pdf_reporte_url en el modelo Reordenamiento
#    - Si falla: reintentar hasta 3 veces con backoff exponencial (autoretry_for)
#    - Registrar en AuditLog que el PDF fue generado
#
# 2. @shared_task recalcular_metricas_laboratorio(laboratorio_id):
#    - Llamar InventoryAnalyticsService.calcular_deficit_laboratorio(laboratorio_id)
#    - Llamar InventoryAnalyticsService.detectar_excedentes(laboratorio_id)
#    - Guardar resultados en caché Redis con TTL=3600
#    - Esta tarea se programa nocturnamente desde Celery Beat
#
# Incluir manejo de excepciones con logging detallado

import logging
import os
from datetime import datetime

from celery import shared_task
from django.core.cache import cache
from django.template import TemplateDoesNotExist
from django.template.loader import render_to_string
from django.utils import timezone

from apps.laboratorios.services import InventoryAnalyticsService
from apps.reordenamiento.models import Reordenamiento
from apps.usuarios.models import AuditLog


logger = logging.getLogger(__name__)


def _render_reporte_html(context):
	try:
		return render_to_string("reordenamiento/reporte_pdf.html", context)
	except TemplateDoesNotExist:
		logger.warning(
			"Template reordenamiento/reporte_pdf.html no encontrado; usando fallback inline"
		)
		return f"""
		<html>
		<head><meta charset='utf-8'><title>Reporte de Reordenamiento</title></head>
		<body>
			<h1>Reporte de Reordenamiento #{context['reordenamiento'].id}</h1>
			<p><strong>Equipo:</strong> {context['equipo'].nombre}</p>
			<p><strong>Origen:</strong> {context['origen'].nombre}</p>
			<p><strong>Destino:</strong> {context['destino'].nombre}</p>
			<p><strong>Cantidad:</strong> {context['reordenamiento'].cantidad_trasladada}</p>
			<p><strong>Resolucion:</strong> {context['reordenamiento'].resolucion_numero}</p>
			<p><strong>Fecha autorizacion:</strong> {context['reordenamiento'].fecha_autorizacion}</p>
			<p><strong>Autorizado por:</strong> {context.get('autorizador_nombre') or 'N/A'}</p>
		</body>
		</html>
		"""


def _render_pdf_bytes(html):
	from weasyprint import HTML

	return HTML(string=html).write_pdf()


def _upload_pdf_s3(pdf_bytes, filename):
	import boto3

	endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL")
	access_key = os.getenv("AWS_ACCESS_KEY_ID")
	secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
	region_name = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
	bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME", "reportes")

	client_kwargs = {
		"region_name": region_name,
	}
	if endpoint_url:
		client_kwargs["endpoint_url"] = endpoint_url
	if access_key and secret_key:
		client_kwargs["aws_access_key_id"] = access_key
		client_kwargs["aws_secret_access_key"] = secret_key

	s3_client = boto3.client("s3", **client_kwargs)

	key = f"reportes/reordenamientos/{filename}"
	s3_client.put_object(
		Bucket=bucket_name,
		Key=key,
		Body=pdf_bytes,
		ContentType="application/pdf",
	)

	custom_domain = os.getenv("AWS_S3_CUSTOM_DOMAIN")
	if custom_domain:
		return f"https://{custom_domain}/{key}"

	if endpoint_url:
		return f"{endpoint_url.rstrip('/')}/{bucket_name}/{key}"

	return f"s3://{bucket_name}/{key}"


@shared_task(
	bind=True,
	autoretry_for=(Exception,),
	retry_backoff=True,
	retry_kwargs={"max_retries": 3},
)
def generar_pdf_reordenamiento(self, reordenamiento_id):
	logger.info("Iniciando generacion de PDF para reordenamiento_id=%s", reordenamiento_id)

	reordenamiento = Reordenamiento.objects.select_related(
		"equipo",
		"laboratorio_origen",
		"laboratorio_destino",
		"autorizado_por",
		"ejecutado_por",
	).get(id=reordenamiento_id)

	context = {
		"reordenamiento": reordenamiento,
		"equipo": reordenamiento.equipo,
		"origen": reordenamiento.laboratorio_origen,
		"destino": reordenamiento.laboratorio_destino,
		"autorizador_nombre": (
			reordenamiento.autorizado_por.nombre_completo
			if reordenamiento.autorizado_por
			else None
		),
		"fecha_generacion": timezone.now(),
	}

	try:
		html = _render_reporte_html(context)
		pdf_bytes = _render_pdf_bytes(html)

		timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
		filename = f"reordenamiento_{reordenamiento_id}_{timestamp}.pdf"
		pdf_url = _upload_pdf_s3(pdf_bytes, filename)

		reordenamiento.pdf_reporte_url = pdf_url
		reordenamiento.save(update_fields=["pdf_reporte_url", "updated_at"])

		AuditLog.objects.create(
			tabla_afectada="Reordenamiento",
			registro_id=reordenamiento.id,
			accion=AuditLog.Accion.UPDATE,
			usuario=reordenamiento.autorizado_por,
			datos_nuevos={
				"evento": "pdf_generado",
				"pdf_reporte_url": pdf_url,
			},
		)

		logger.info(
			"PDF generado y subido correctamente para reordenamiento_id=%s, url=%s",
			reordenamiento_id,
			pdf_url,
		)
		return {"reordenamiento_id": reordenamiento_id, "pdf_reporte_url": pdf_url}
	except Exception:
		logger.exception(
			"Error generando/subiendo PDF para reordenamiento_id=%s",
			reordenamiento_id,
		)
		raise


@shared_task(
	bind=True,
	autoretry_for=(Exception,),
	retry_backoff=True,
	retry_kwargs={"max_retries": 3},
)
def recalcular_metricas_laboratorio(self, laboratorio_id):
	logger.info("Recalculando metricas para laboratorio_id=%s", laboratorio_id)

	try:
		deficits = InventoryAnalyticsService.calcular_deficit_laboratorio(laboratorio_id)
		excedentes = InventoryAnalyticsService.detectar_excedentes(laboratorio_id)

		payload = {
			"laboratorio_id": laboratorio_id,
			"deficits": deficits,
			"excedentes": excedentes,
			"generado_en": timezone.now().isoformat(),
		}

		cache.set(
			InventoryAnalyticsService._cache_key(laboratorio_id),
			payload,
			timeout=InventoryAnalyticsService.CACHE_TTL,
		)

		logger.info("Metricas recalculadas y cacheadas para laboratorio_id=%s", laboratorio_id)
		return payload
	except Exception:
		logger.exception("Error al recalcular metricas para laboratorio_id=%s", laboratorio_id)
		raise
