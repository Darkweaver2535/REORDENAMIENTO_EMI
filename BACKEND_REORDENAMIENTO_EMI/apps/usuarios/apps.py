from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    name = 'apps.usuarios'

    def ready(self):
        import apps.usuarios.signals  # noqa: F401
