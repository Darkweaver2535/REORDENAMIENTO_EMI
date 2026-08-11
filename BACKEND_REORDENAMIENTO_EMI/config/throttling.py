"""
Throttles que sobreviven a una caída de la caché.

Son los `DEFAULT_THROTTLE_CLASSES` del proyecto. Sólo cambian el almacén: en vez
de escribir directamente en Redis usan `cache_resiliente`, que cae a memoria
local si Redis no responde. Sin esto, una caída de Redis devolvía 500 en cada
petición de la API.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from config.cache_resiliente import cache_resiliente


class AnonRateThrottleResiliente(AnonRateThrottle):
    cache = cache_resiliente


class UserRateThrottleResiliente(UserRateThrottle):
    cache = cache_resiliente
