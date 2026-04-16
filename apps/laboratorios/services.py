# App: laboratorios | Archivo: services.py
# Sistema de gestión de laboratorios universitarios
#
# TAREA: Crear la clase InventoryAnalyticsService con todos los métodos
# de análisis de inventario. Esta es la lógica más crítica del sistema.
#
# class InventoryAnalyticsService:
#
# 1. calcular_uso_equipo(equipo_id) -> dict:
#    Calcula cuántas prácticas usa un equipo.
#    Retorna: {equipo_id, nombre, cantidad_disponible, total_practicas_que_usa,
#    pct_uso (float 0-100), es_ocioso (bool: pct_uso == 0)}
#
# 2. calcular_deficit_laboratorio(laboratorio_id) -> list[dict]:
#    Para cada EquipoRequeridoPorGuia vinculado al laboratorio,
#    detectar si hay déficit (cantidad_disponible < cantidad_requerida).
#    Retorna lista de: {nombre_equipo, cantidad_disponible, cantidad_requerida,
#    deficit (int), tiene_deficit (bool)}
#
# 3. calcular_ratio_por_estudiantes(laboratorio_id) -> dict:
#    ratio = cantidad_disponible_total / capacidad_estudiantes del laboratorio
#    Retorna: {laboratorio_id, nombre, capacidad_estudiantes,
#    total_equipos_disponibles, ratio_equipo_por_estudiante (float)}
#
# 4. comparar_sedes_para_equipo(nombre_equipo_teorico) -> list[dict]:
#    Busca un equipo por nombre aproximado (icontains) en TODOS los laboratorios.
#    Compara disponibilidad vs. demanda teórica entre sedes.
#    Retorna lista ordenada por déficit descendente:
#    [{sede, laboratorio, cantidad_disponible, cantidad_requerida, deficit, ratio}]
#    ESTA función detecta la desproporción La Paz (100 estudiantes, 4 balanzas)
#    vs Riberalta (10 estudiantes, 2 balanzas)
#
# 5. detectar_excedentes(laboratorio_id) -> list[dict]:
#    Equipos con pct_uso < 10% O cantidad_disponible > (max_requerido * 2)
#    Candidatos para reordenamiento a otra sede.
#    Retorna: [{equipo_id, nombre, cantidad_disponible, max_requerido, excedente}]
#
# Usar select_related y prefetch_related para evitar N+1 queries.
# Cachear resultados en Redis con key='analytics:{laboratorio_id}' TTL=3600 segundos.
# Invalidar caché cuando se actualiza cualquier Equipo del laboratorio (via signal).
