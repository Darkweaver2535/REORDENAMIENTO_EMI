# App: usuarios | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear los siguientes modelos:
#
# 1. Modelo 'Usuario' que extienda AbstractUser de Django con estos campos adicionales:
#    - carnet_identidad: CharField(20) UNIQUE NOT NULL
#    - saga_username: CharField(100) null=True blank=True
#    - nombre_completo: CharField(200)
#    - rol: CharField con choices:
#      ESTUDIANTE, DOCENTE, ADMIN, JEFE, DECANO, ENCARGADO_ACTIVOS
#    - unidad_academica: ForeignKey a 'estructura_academica.UnidadAcademica'
#      (null=True para superusuarios)
#    - USERNAME_FIELD = 'carnet_identidad' (login por CI, no por username)
#    - Método: get_rol_display() que retorne el nombre legible del rol
#    - Método: tiene_permiso_admin() que retorne True si rol in [ADMIN, JEFE, DECANO]
#
# 2. Modelo 'AuditLog' con campos:
#    - tabla_afectada: CharField(100)
#    - registro_id: IntegerField
#    - accion: CharField con choices: CREATE, UPDATE, DELETE, APPROVE, MOVE, PUBLISH
#    - usuario: ForeignKey a Usuario (null=True, on_delete=SET_NULL)
#    - datos_anteriores: JSONField null=True (estado antes del cambio)
#    - datos_nuevos: JSONField null=True (estado después del cambio)
#    - timestamp: DateTimeField(auto_now_add=True)
#    - ip_address: GenericIPAddressField null=True
#    - Meta: ordering = ['-timestamp'], verbose_name_plural = 'Registros de auditoría'
#
# Incluir __str__ descriptivos para cada modelo

from django.db import models

# Create your models here.
