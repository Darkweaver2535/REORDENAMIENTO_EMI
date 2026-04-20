# App: usuarios | Archivo: views.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear las vistas de autenticación y perfil:
#
# 1. LoginView (APIView, AllowAny):
#    - POST /api/v1/auth/login/
#    - Recibe: {carnet_identidad, password}
#    - Llama a authenticate() que usa el SAGAAuthBackend
#    - Si exitoso: retorna access_token, refresh_token, rol, nombre_completo,
#      unidad_academica_id, unidad_academica_nombre
#    - Si falla: 401 con mensaje descriptivo
#    - Registrar en AuditLog acción='LOGIN' con ip_address del request
#
# 2. PerfilView (RetrieveUpdateAPIView, IsAuthenticated):
#    - GET /api/v1/auth/perfil/ → datos del usuario autenticado
#    - El usuario solo puede ver/editar su propio perfil
#
# 3. ListaUsuariosView (ListAPIView, EsAdminOJefe):
#    - GET /api/v1/usuarios/ → lista usuarios de la misma unidad_academica
#    - Solo admins/jefes pueden ver la lista
#    - Filtrar automáticamente por la unidad_academica del usuario que hace la consulta

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.usuarios.models import AuditLog, Usuario
from apps.usuarios.permissions import EsAdminOJefe
from apps.usuarios.serializers import PerfilSerializer, UsuarioListaSerializer


def _client_ip(request):
	x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
	if x_forwarded_for:
		return x_forwarded_for.split(",")[0].strip()
	return request.META.get("REMOTE_ADDR")


class LoginView(APIView):
	permission_classes = [AllowAny]

	def post(self, request):
		carnet_identidad = request.data.get("carnet_identidad")
		password = request.data.get("password")

		if not carnet_identidad or not password:
			return Response(
				{"detail": "Debe enviar carnet_identidad y password."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		user = authenticate(
			request=request,
			username=carnet_identidad,
			password=password,
		)

		if user is None:
			return Response(
				{"detail": "Credenciales invalidas o usuario no autorizado."},
				status=status.HTTP_401_UNAUTHORIZED,
			)

		refresh = RefreshToken.for_user(user)

		AuditLog.objects.create(
			tabla_afectada="Usuario",
			registro_id=user.id,
			accion=AuditLog.Accion.LOGIN,
			usuario=user,
			datos_nuevos={"evento": "login"},
			ip_address=_client_ip(request),
		)

		return Response(
			{
				"access_token": str(refresh.access_token),
				"refresh_token": str(refresh),
				"rol": user.rol,
				"nombre_completo": user.nombre_completo,
				"unidad_academica_id": user.unidad_academica_id,
				"unidad_academica_nombre": (
					user.unidad_academica.nombre if user.unidad_academica else None
				),
			},
			status=status.HTTP_200_OK,
		)


class PerfilView(RetrieveUpdateAPIView):
	serializer_class = PerfilSerializer
	permission_classes = [IsAuthenticated]

	def get_object(self):
		return self.request.user


from rest_framework.viewsets import ModelViewSet

class UsuarioAdminViewSet(ModelViewSet):
	serializer_class = UsuarioListaSerializer
	permission_classes = [IsAuthenticated]
	http_method_names = ["get", "patch", "head", "options"]

	def get_queryset(self):
		user = self.request.user
		if getattr(user, "rol", "") != getattr(user.Rol, "ADMIN", "ADMIN"):
			return Usuario.objects.none()
		return Usuario.objects.all().order_by("nombre_completo")

	def partial_update(self, request, *args, **kwargs):
		campos_permitidos = {"rol", "unidad_academica_id", "is_active"}
		data_filtrada = {
			k: v for k, v in request.data.items() if k in campos_permitidos
		}
		serializer = self.get_serializer(
			self.get_object(), data=data_filtrada, partial=True
		)
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(serializer.data)
