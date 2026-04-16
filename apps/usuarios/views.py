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

from django.shortcuts import render

# Create your views here.
