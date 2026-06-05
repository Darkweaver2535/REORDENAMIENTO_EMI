"""
Almacenamiento de imágenes de equipos (#11).

Completa la intención que estaba a medias: `Equipo.foto_url` era un URLField
manual y boto3/S3 estaba instalado sin usarse para imágenes. Este módulo provee
una función de subida que:

  · Sube a S3/MinIO cuando las variables AWS_* están configuradas.
  · Cae a almacenamiento local (MEDIA_ROOT) cuando no lo están, de modo que la
    función ya es útil en desarrollo sin infraestructura S3.

Devuelve siempre una URL utilizable para guardar en `foto_url`.
"""

import os
import uuid

from django.core.files.storage import default_storage

EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024  # 5 MB


class ErrorImagen(Exception):
    """Imagen inválida (formato o tamaño)."""


def _validar(archivo):
    nombre = getattr(archivo, "name", "") or ""
    ext = os.path.splitext(nombre)[1].lower()
    if ext not in EXTENSIONES_IMAGEN:
        raise ErrorImagen(
            f"Formato no permitido ({ext or 'desconocido'}). "
            f"Use: {', '.join(sorted(EXTENSIONES_IMAGEN))}."
        )
    tamano = getattr(archivo, "size", 0) or 0
    if tamano > TAMANO_MAXIMO_BYTES:
        raise ErrorImagen("La imagen supera el tamaño máximo de 5 MB.")
    return ext


def _s3_configurado():
    return bool(os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"))


def _subir_s3(archivo, key):
    import boto3

    endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL")
    region_name = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
    bucket_name = os.getenv("AWS_STORAGE_BUCKET_NAME", "reportes")

    client_kwargs = {"region_name": region_name}
    if endpoint_url:
        client_kwargs["endpoint_url"] = endpoint_url
    client_kwargs["aws_access_key_id"] = os.getenv("AWS_ACCESS_KEY_ID")
    client_kwargs["aws_secret_access_key"] = os.getenv("AWS_SECRET_ACCESS_KEY")

    s3_client = boto3.client("s3", **client_kwargs)
    archivo.seek(0)
    s3_client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=archivo.read(),
        ContentType=getattr(archivo, "content_type", "application/octet-stream"),
    )

    custom_domain = os.getenv("AWS_S3_CUSTOM_DOMAIN")
    if custom_domain:
        return f"https://{custom_domain}/{key}"
    if endpoint_url:
        return f"{endpoint_url.rstrip('/')}/{bucket_name}/{key}"
    return f"https://{bucket_name}.s3.{region_name}.amazonaws.com/{key}"


def _subir_local(archivo, key):
    archivo.seek(0)
    ruta = default_storage.save(key, archivo)
    try:
        return default_storage.url(ruta)
    except (NotImplementedError, ValueError):
        return f"/media/{ruta}"


def subir_imagen_equipo(archivo, equipo_id, base_url=None):
    """Sube la imagen de un equipo y devuelve su URL pública.

    base_url: prefijo opcional (p. ej. request.build_absolute_uri('/')[:-1])
    para devolver una URL absoluta cuando se usa almacenamiento local.
    """
    ext = _validar(archivo)
    key = f"equipos/fotos/{equipo_id}_{uuid.uuid4().hex}{ext}"

    if _s3_configurado():
        return _subir_s3(archivo, key)

    url = _subir_local(archivo, key)
    if base_url and url.startswith("/"):
        return f"{base_url.rstrip('/')}{url}"
    return url
