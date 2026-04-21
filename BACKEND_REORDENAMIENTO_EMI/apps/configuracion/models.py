from django.db import models


class ConfiguracionSistema(models.Model):
    saga_auth_url = models.URLField(blank=True)
    modulo_reactivos_activo = models.BooleanField(default=False)
    nombre_sistema = models.CharField(max_length=100, default='SGL - EMI')
    version = models.CharField(max_length=20, default='1.0.0')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración del Sistema"
        verbose_name_plural = "Configuraciones del Sistema"

    def save(self, *args, **kwargs):
        # Patrón singleton: solo puede existir un registro
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"{self.nombre_sistema} (v{self.version})"
