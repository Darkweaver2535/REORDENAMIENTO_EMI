# Instrucciones del Proyecto: REORDENAMIENTO_EMI

## Stack
- Backend: Django 5.x + Django REST Framework
- Base de datos: PostgreSQL 16 con psycopg2
- Autenticación: JWT con djangorestframework-simplejwt
- Tareas async: Celery + Redis
- Almacenamiento: MinIO/S3 con boto3

## Arquitectura
- Cada módulo es una Django app independiente en /apps/
- Los modelos usan códigos institucionales como UNIQUE keys, no texto libre
- Todos los ViewSets heredan de ModelViewSet con permisos por rol
- Los servicios de negocio van en services.py dentro de cada app
- Las tareas asíncronas van en tasks.py (Celery)

## Convenciones
- Español para nombres de modelos y comentarios
- Inglés para nombres de variables y funciones
- Siempre incluir AuditLog en operaciones críticas (CREATE/UPDATE/DELETE)
- Los PDFs y imágenes se almacenan en S3, nunca en el filesystem local