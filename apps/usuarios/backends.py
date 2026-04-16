# App: usuarios | Archivo: backends.py
# Sistema de gestión de laboratorios universitarios
#
# TAREA: Crear un Authentication Backend personalizado para Django llamado SAGAAuthBackend.
# Este backend debe:
# 1. Intentar autenticar contra un endpoint externo SAGA (URL en .env como SAGA_AUTH_URL)
#    Hacer un POST a SAGA_AUTH_URL con {username: carnet_identidad, password: password}
#    usando la librería 'requests' con timeout=5 segundos
# 2. Si SAGA responde con 200 OK:
#    a. Buscar el Usuario en la BD local por carnet_identidad
#    b. Si NO existe: crear el Usuario con los datos que retorna SAGA
#       (nombre, email, carnet) y rol=ESTUDIANTE por defecto
#    c. Si SÍ existe: actualizar nombre y email si cambiaron
#    d. Retornar el objeto Usuario
# 3. Si SAGA falla (timeout, error de red, servidor caído):
#    Hacer fallback: intentar autenticar contra la BD local de Django con check_password()
#    Esto permite seguir funcionando en modo offline o si SAGA está caído
# 4. Si ambos fallan: retornar None
# 5. Manejar todas las excepciones (requests.exceptions.Timeout, ConnectionError, etc.)
#    con logging apropiado (usar logging.getLogger(__name__))
# 6. Método get_user(user_id) requerido por Django
