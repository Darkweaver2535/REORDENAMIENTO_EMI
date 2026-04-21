from django.apps import AppConfig


class LaboratoriosConfig(AppConfig):
    name = 'apps.laboratorios'

    def ready(self):
        from apps.laboratorios import signals  # noqa: F401
