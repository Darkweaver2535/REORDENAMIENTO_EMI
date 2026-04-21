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
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _


class UsuarioManager(BaseUserManager):
	"""Manager para autenticacion por carnet de identidad."""

	use_in_migrations = True

	def _create_user(self, carnet_identidad, password, **extra_fields):
		if not carnet_identidad:
			raise ValueError("El carnet_identidad es obligatorio")

		carnet_identidad = self.model.normalize_username(carnet_identidad)
		user = self.model(carnet_identidad=carnet_identidad, **extra_fields)
		user.set_password(password)
		user.save(using=self._db)
		return user

	def create_user(self, carnet_identidad, password=None, **extra_fields):
		extra_fields.setdefault("is_staff", False)
		extra_fields.setdefault("is_superuser", False)
		return self._create_user(carnet_identidad, password, **extra_fields)

	def create_superuser(self, carnet_identidad, password, **extra_fields):
		extra_fields.setdefault("is_staff", True)
		extra_fields.setdefault("is_superuser", True)

		if extra_fields.get("is_staff") is not True:
			raise ValueError("Superuser debe tener is_staff=True")
		if extra_fields.get("is_superuser") is not True:
			raise ValueError("Superuser debe tener is_superuser=True")

		return self._create_user(carnet_identidad, password, **extra_fields)


class Usuario(AbstractUser):
	class Rol(models.TextChoices):
		ESTUDIANTE = "ESTUDIANTE", "Estudiante"
		DOCENTE = "DOCENTE", "Docente"
		ADMIN = "ADMIN", "Administrador"
		JEFE = "JEFE", "Jefe"
		DECANO = "DECANO", "Decano"
		ENCARGADO_ACTIVOS = "ENCARGADO_ACTIVOS", "Encargado de Activos"

	# Desactiva login por username tradicional para usar carnet_identidad.
	username = None

	carnet_identidad = models.CharField(max_length=20, unique=True)
	saga_username = models.CharField(max_length=100, null=True, blank=True)
	nombre_completo = models.CharField(max_length=200)
	rol = models.CharField(max_length=30, choices=Rol.choices)
	unidad_academica = models.ForeignKey(
		"estructura_academica.UnidadAcademica",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="usuarios",
	)

	USERNAME_FIELD = "carnet_identidad"
	REQUIRED_FIELDS = ["nombre_completo"]

	objects = UsuarioManager()

	class Meta:
		ordering = ["nombre_completo"]
		verbose_name = "Usuario"
		verbose_name_plural = "Usuarios"

	def __str__(self):
		return f"{self.nombre_completo} ({self.carnet_identidad}) - {self.get_rol_display()}"

	def get_rol_display(self):
		return dict(self.Rol.choices).get(self.rol, self.rol)

	def tiene_permiso_admin(self):
		return self.rol in {self.Rol.ADMIN, self.Rol.JEFE, self.Rol.DECANO}


class AuditLog(models.Model):
	class Accion(models.TextChoices):
		LOGIN = "LOGIN", "Inicio de sesion"
		CREATE = "CREATE", "Creacion"
		UPDATE = "UPDATE", "Actualizacion"
		DELETE = "DELETE", "Eliminacion"
		APPROVE = "APPROVE", "Aprobacion"
		MOVE = "MOVE", "Movimiento"
		PUBLISH = "PUBLISH", "Publicacion"

	tabla_afectada = models.CharField(max_length=100)
	registro_id = models.IntegerField()
	accion = models.CharField(max_length=20, choices=Accion.choices)
	usuario = models.ForeignKey(
		"usuarios.Usuario",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="auditorias",
	)
	datos_anteriores = models.JSONField(null=True, blank=True)
	datos_nuevos = models.JSONField(null=True, blank=True)
	timestamp = models.DateTimeField(auto_now_add=True)
	ip_address = models.GenericIPAddressField(null=True, blank=True)

	class Meta:
		ordering = ["-timestamp"]
		verbose_name = "Registro de auditoria"
		verbose_name_plural = "Registros de auditoria"

	def __str__(self):
		usuario_label = self.usuario.nombre_completo if self.usuario else "Sistema"
		return (
			f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.accion} en "
			f"{self.tabla_afectada}#{self.registro_id} por {usuario_label}"
		)
