"""
Caché tolerante a fallos y throttles que no tumban la API.

Problema real observado: con Redis caído, TODA petición devolvía 500. El
throttling de DRF escribe en la caché en cada request, así que una caída del
servicio de caché —que sólo debería degradar el rendimiento— dejaba el sistema
entero fuera de servicio.

`CacheResiliente` delega en la caché configurada y, si ésta falla, cae a una
caché en memoria del proceso. Las consecuencias del modo degradado:

  · Rate limiting: sigue activo, pero por proceso en vez de compartido. Con
    varios workers el límite efectivo se multiplica por el número de workers.
    Es una protección peor que la normal, pero muy superior a no tener API.
  · Analítica de laboratorios: se recalcula más veces (la caché local no se
    comparte). Sólo cuesta CPU.
"""

import logging

from django.core.cache import caches
from django.core.cache.backends.locmem import LocMemCache

logger = logging.getLogger(__name__)

# Respaldo en memoria del proceso; se usa sólo cuando la caché real falla.
_respaldo = LocMemCache("respaldo-cache-caida", {"TIMEOUT": 300})


class CacheResiliente:
    """Proxy de caché: si el backend real falla, usa memoria local."""

    _degradado = False

    def _real(self):
        return caches["default"]

    def _aviso(self, exc):
        # Sólo se avisa en la primera caída para no inundar el log.
        if not CacheResiliente._degradado:
            CacheResiliente._degradado = True
            logger.error(
                "Caché no disponible (%s). Se degrada a memoria local: el rate "
                "limiting pasa a ser por proceso hasta que se restablezca.",
                exc,
            )

    def get(self, key, default=None, **kwargs):
        try:
            valor = self._real().get(key, default, **kwargs)
            CacheResiliente._degradado = False
            return valor
        except Exception as exc:  # noqa: BLE001 — cualquier fallo del backend
            self._aviso(exc)
            return _respaldo.get(key, default, **kwargs)

    def set(self, key, value, timeout=None, **kwargs):
        try:
            self._real().set(key, value, timeout, **kwargs)
        except Exception as exc:  # noqa: BLE001
            self._aviso(exc)
            _respaldo.set(key, value, timeout, **kwargs)

    def delete(self, key, **kwargs):
        try:
            self._real().delete(key, **kwargs)
        except Exception as exc:  # noqa: BLE001
            self._aviso(exc)
        _respaldo.delete(key, **kwargs)

    def incr(self, key, delta=1, **kwargs):
        try:
            return self._real().incr(key, delta, **kwargs)
        except Exception as exc:  # noqa: BLE001
            self._aviso(exc)
            return _respaldo.incr(key, delta, **kwargs)


cache_resiliente = CacheResiliente()
