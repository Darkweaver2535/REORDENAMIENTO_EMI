import getpass
from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent


# Seguridad
SECRET_KEY = config("DJANGO_SECRET_KEY")
# SEGURIDAD: el default es False. Para desarrollo local agrega DJANGO_DEBUG=True en el .env.
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())


# Aplicaciones
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "apps.usuarios",
    "apps.estructura_academica",
    "apps.guias",
    "apps.laboratorios",
    "apps.reordenamiento",
    "apps.reactivos",
    "apps.dashboard",
    "apps.notificaciones",
    "apps.reportes",
    "apps.configuracion",
    "apps.evaluaciones",
    "apps.mantenimientos",
]

AUTH_USER_MODEL = "usuarios.Usuario"

SAGA_AUTH_URL = config("SAGA_AUTH_URL", default="")

# IA local para consultas gerenciales (Ollama + gemma)
OLLAMA_URL = config("OLLAMA_URL", default="http://localhost:11434")
OLLAMA_MODEL = config("OLLAMA_MODEL", default="gemma4:latest")
OLLAMA_TIMEOUT = config("OLLAMA_TIMEOUT", default=120, cast=int)

AUTHENTICATION_BACKENDS = (
    "apps.usuarios.backends.SAGAAuthBackend",
    "django.contrib.auth.backends.ModelBackend",
)

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Base de datos (PostgreSQL)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="reordenamiento_emi"),
        "USER": config("DB_USER", default=getpass.getuser()),
        "PASSWORD": config("DB_PASSWORD", default=""),
        "HOST": config("DB_HOST", default=""),
        "PORT": config("DB_PORT", default="5432"),
    }
}


# Validadores de contraseñas
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internacionalizacion
LANGUAGE_CODE = "es-bo"
TIME_ZONE = "America/La_Paz"
USE_I18N = True
USE_TZ = True


# Archivos estaticos y media
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "PAGE_SIZE_QUERY_PARAM": "page_size",
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    # Throttling (#2): protección contra fuerza bruta y abuso de API.
    # LoginView tiene su propio throttle más estricto (ver views.py).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",  # Anónimos: 60 req/min (navegación pública)
        "user": "300/minute",  # Usuarios autenticados: 300 req/min
        "login": "5/minute",  # Login: 5 intentos/min por IP (fuerza bruta)
    },
    # Documentación de API (#6): drf-spectacular genera el schema OpenAPI 3.
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}


# drf-spectacular: OpenAPI 3 / Swagger / ReDoc (#6)
SPECTACULAR_SETTINGS = {
    "TITLE": "API — Sistema de Reordenamiento de Laboratorios EMI",
    "DESCRIPTION": (
        "API REST para la gestión de laboratorios, inventario de equipos, "
        "reordenamientos (reasignación, compra, préstamo) y reportes."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,  # No exponer el endpoint /schema/ en el UI
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,  # Mantiene el token Bearer entre recargas
    },
}


# JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# CORS
# FIX #21: se lee de la variable de entorno CORS_ALLOWED_ORIGINS (CSV) en lugar
# de estar hardcodeado. El default cubre el puerto de Vite (5173) para desarrollo
# local; en producción se define en el .env / variables del servidor.
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)

CORS_ALLOW_CREDENTIALS = True

# Cache (Redis)
CACHE_URL = config("CACHE_URL", default="redis://localhost:6379/2")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": CACHE_URL,
    }
}


# Celery
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE


# Logging basico a consola
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "[{levelname}] {asctime} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO" if not DEBUG else "DEBUG",
    },
}


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ── Security headers para producción (#3) ────────────────────────────────────
# Solo se activan cuando DEBUG=False (producción/staging).
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31_536_000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
