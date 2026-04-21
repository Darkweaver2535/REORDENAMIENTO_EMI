import logging

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend


logger = logging.getLogger(__name__)


class SAGAAuthBackend(BaseBackend):
	"""Backend de autenticacion contra SAGA con fallback local."""

	def authenticate(self, request, username=None, password=None, carnet_identidad=None, **kwargs):
		user_model = get_user_model()
		ci = carnet_identidad or username or kwargs.get(user_model.USERNAME_FIELD)

		if not ci or not password:
			return None

		saga_url = getattr(settings, "SAGA_AUTH_URL", "")

		if not saga_url:
			logger.warning("SAGA_AUTH_URL no configurada; usando autenticacion local")
			return self._authenticate_local(ci, password)

		try:
			response = requests.post(
				saga_url,
				json={"username": ci, "password": password},
				timeout=5,
			)
		except requests.exceptions.Timeout:
			logger.warning("Timeout al conectar con SAGA para CI=%s", ci)
			return self._authenticate_local(ci, password)
		except requests.exceptions.ConnectionError:
			logger.warning("Error de conexion con SAGA para CI=%s", ci)
			return self._authenticate_local(ci, password)
		except requests.exceptions.RequestException as exc:
			logger.exception("Error HTTP inesperado con SAGA para CI=%s: %s", ci, exc)
			return self._authenticate_local(ci, password)

		if response.status_code == 200:
			saga_data = self._safe_json(response)
			return self._sync_user_from_saga(ci, saga_data)

		logger.info("Autenticacion SAGA rechazada para CI=%s (status=%s)", ci, response.status_code)
		return None

	def _safe_json(self, response):
		try:
			data = response.json()
			if isinstance(data, dict):
				return data
		except ValueError:
			logger.warning("Respuesta SAGA no es JSON valido")
		return {}

	def _sync_user_from_saga(self, carnet_identidad, saga_data):
		user_model = get_user_model()

		nombre = (
			saga_data.get("nombre")
			or saga_data.get("nombre_completo")
			or saga_data.get("name")
			or carnet_identidad
		)
		email = saga_data.get("email", "")
		saga_username = saga_data.get("username") or saga_data.get("saga_username")
		carnet = saga_data.get("carnet") or carnet_identidad

		user = user_model.objects.filter(carnet_identidad=carnet).first()

		if user is None:
			user = user_model.objects.create(
				carnet_identidad=carnet,
				nombre_completo=nombre,
				email=email,
				saga_username=saga_username,
				rol=user_model.Rol.ESTUDIANTE,
			)
			user.set_unusable_password()
			user.save(update_fields=["password"])
			logger.info("Usuario creado desde SAGA: CI=%s", carnet)
			return user

		update_fields = []
		if user.nombre_completo != nombre:
			user.nombre_completo = nombre
			update_fields.append("nombre_completo")
		if user.email != email:
			user.email = email
			update_fields.append("email")
		if user.saga_username != saga_username:
			user.saga_username = saga_username
			update_fields.append("saga_username")

		if update_fields:
			user.save(update_fields=update_fields)
			logger.info("Usuario actualizado desde SAGA: CI=%s campos=%s", carnet, update_fields)

		return user

	def _authenticate_local(self, carnet_identidad, password):
		user_model = get_user_model()
		user = user_model.objects.filter(carnet_identidad=carnet_identidad).first()
		if user and user.check_password(password) and self.user_can_authenticate(user):
			logger.info("Autenticacion local fallback exitosa para CI=%s", carnet_identidad)
			return user
		return None

	def user_can_authenticate(self, user):
		is_active = getattr(user, "is_active", None)
		return is_active or is_active is None

	def get_user(self, user_id):
		user_model = get_user_model()
		try:
			return user_model.objects.get(pk=user_id)
		except user_model.DoesNotExist:
			return None
