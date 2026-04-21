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

from django.core.cache import cache
from django.db.models import Count, ExpressionWrapper, F, IntegerField, Max, Sum

from apps.laboratorios.models import Equipo, EquipoRequeridoPorGuia, Laboratorio


class InventoryAnalyticsService:
	CACHE_TTL = 3600

	@classmethod
	def _cache_key(cls, laboratorio_id):
		return f"analytics:{laboratorio_id}"

	@classmethod
	def invalidar_cache_laboratorio(cls, laboratorio_id):
		if laboratorio_id:
			cache.delete(cls._cache_key(laboratorio_id))

	@classmethod
	def _total_practicas_laboratorio(cls, laboratorio_id):
		return (
			Laboratorio.objects.filter(id=laboratorio_id)
			.values_list("asignaturas", flat=True)
			.distinct()
			.count()
		)

	@classmethod
	def calcular_uso_equipo(cls, equipo_id):
		equipo = (
			Equipo.objects.select_related("laboratorio")
			.prefetch_related("guias_que_requieren__guia")
			.get(id=equipo_id)
		)

		total_practicas_lab = cls._total_practicas_laboratorio(equipo.laboratorio_id)
		total_practicas_que_usa = (
			EquipoRequeridoPorGuia.objects.filter(equipo_id=equipo.id)
			.values("guia_id")
			.distinct()
			.count()
		)

		cantidad_disponible = equipo.cantidad_disponible()
		pct_uso = 0.0
		if total_practicas_lab > 0:
			pct_uso = round((total_practicas_que_usa / total_practicas_lab) * 100, 2)

		return {
			"equipo_id": equipo.id,
			"nombre": equipo.nombre,
			"cantidad_disponible": cantidad_disponible,
			"total_practicas_que_usa": total_practicas_que_usa,
			"pct_uso": pct_uso,
			"es_ocioso": pct_uso == 0,
		}

	@classmethod
	def calcular_deficit_laboratorio(cls, laboratorio_id):
		requeridos = (
			EquipoRequeridoPorGuia.objects.select_related("equipo")
			.filter(guia__asignatura__laboratorios__id=laboratorio_id)
			.distinct()
		)

		resultados = []
		for req in requeridos:
			cantidad_disponible = req.equipo.cantidad_disponible() if req.equipo else 0
			deficit = max(0, req.cantidad_requerida - cantidad_disponible)
			resultados.append(
				{
					"nombre_equipo": req.nombre_equipo_teorico,
					"cantidad_disponible": cantidad_disponible,
					"cantidad_requerida": req.cantidad_requerida,
					"deficit": deficit,
					"tiene_deficit": deficit > 0,
				}
			)

		return resultados

	@classmethod
	def calcular_ratio_por_estudiantes(cls, laboratorio_id):
		laboratorio = Laboratorio.objects.select_related("unidad_academica").get(id=laboratorio_id)

		total_disponible = (
			Equipo.objects.filter(laboratorio_id=laboratorio_id).aggregate(
				total=Sum(
					ExpressionWrapper(
						F("cantidad_buena") + F("cantidad_regular"),
						output_field=IntegerField(),
					)
				)
			)["total"]
			or 0
		)

		ratio = 0.0
		if laboratorio.capacidad_estudiantes > 0:
			ratio = round(total_disponible / laboratorio.capacidad_estudiantes, 4)

		return {
			"laboratorio_id": laboratorio.id,
			"nombre": laboratorio.nombre,
			"capacidad_estudiantes": laboratorio.capacidad_estudiantes,
			"total_equipos_disponibles": total_disponible,
			"ratio_equipo_por_estudiante": ratio,
		}

	@classmethod
	def comparar_sedes_para_equipo(cls, nombre_equipo_teorico):
		nombre_equipo_teorico = (nombre_equipo_teorico or "").strip()
		if not nombre_equipo_teorico:
			return []

		disponible_by_lab = {
			row["laboratorio_id"]: row["total_disponible"]
			for row in Equipo.objects.filter(nombre__icontains=nombre_equipo_teorico)
			.values("laboratorio_id")
			.annotate(
				total_disponible=Sum(
					ExpressionWrapper(
						F("cantidad_buena") + F("cantidad_regular"),
						output_field=IntegerField(),
					)
				)
			)
		}

		demanda_by_lab = {
			row["guia__asignatura__laboratorios__id"]: row["total_requerido"]
			for row in EquipoRequeridoPorGuia.objects.filter(
				nombre_equipo_teorico__icontains=nombre_equipo_teorico
			)
			.values("guia__asignatura__laboratorios__id")
			.annotate(total_requerido=Sum("cantidad_requerida"))
			if row["guia__asignatura__laboratorios__id"] is not None
		}

		laboratorios = Laboratorio.objects.select_related("unidad_academica").all()
		resultados = []
		for lab in laboratorios:
			cantidad_disponible = int(disponible_by_lab.get(lab.id, 0) or 0)
			cantidad_requerida = int(demanda_by_lab.get(lab.id, 0) or 0)
			deficit = max(0, cantidad_requerida - cantidad_disponible)
			ratio = 0.0
			if lab.capacidad_estudiantes > 0:
				ratio = round(cantidad_disponible / lab.capacidad_estudiantes, 4)

			resultados.append(
				{
					"sede": lab.unidad_academica.nombre if lab.unidad_academica_id else None,
					"laboratorio": lab.nombre,
					"cantidad_disponible": cantidad_disponible,
					"cantidad_requerida": cantidad_requerida,
					"deficit": deficit,
					"ratio": ratio,
				}
			)

		resultados.sort(key=lambda x: x["deficit"], reverse=True)
		return resultados

	@classmethod
	def detectar_excedentes(cls, laboratorio_id):
		total_practicas_lab = cls._total_practicas_laboratorio(laboratorio_id)

		equipos = (
			Equipo.objects.filter(laboratorio_id=laboratorio_id)
			.select_related("laboratorio")
			.annotate(
				practicas_uso=Count("guias_que_requieren__guia", distinct=True),
				max_requerido=Max("guias_que_requieren__cantidad_requerida"),
				disponible=ExpressionWrapper(
					F("cantidad_buena") + F("cantidad_regular"),
					output_field=IntegerField(),
				),
			)
		)

		excedentes = []
		for equipo in equipos:
			max_requerido = int(equipo.max_requerido or 0)
			cantidad_disponible = int(equipo.disponible or 0)

			pct_uso = 0.0
			if total_practicas_lab > 0:
				pct_uso = round((equipo.practicas_uso / total_practicas_lab) * 100, 2)

			es_excedente = pct_uso < 10 or cantidad_disponible > (max_requerido * 2)
			if not es_excedente:
				continue

			excedente = max(0, cantidad_disponible - max_requerido)
			excedentes.append(
				{
					"equipo_id": equipo.id,
					"nombre": equipo.nombre,
					"cantidad_disponible": cantidad_disponible,
					"max_requerido": max_requerido,
					"excedente": excedente,
				}
			)

		return excedentes

	@classmethod
	def calcular(cls, laboratorio_id):
		cache_key = cls._cache_key(laboratorio_id)
		cached = cache.get(cache_key)
		if cached is not None:
			return cached

		laboratorio = Laboratorio.objects.select_related("unidad_academica").prefetch_related("equipos").get(
			id=laboratorio_id
		)

		uso_equipos = [cls.calcular_uso_equipo(equipo.id) for equipo in laboratorio.equipos.all()]
		data = {
			"laboratorio_id": laboratorio.id,
			"deficits": cls.calcular_deficit_laboratorio(laboratorio_id),
			"ratio": cls.calcular_ratio_por_estudiantes(laboratorio_id),
			"excedentes": cls.detectar_excedentes(laboratorio_id),
			"uso_equipos": uso_equipos,
		}

		cache.set(cache_key, data, timeout=cls.CACHE_TTL)
		return data
