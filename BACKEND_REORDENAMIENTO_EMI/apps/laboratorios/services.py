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
#    Compara disponibilidad vs. demanda teórica entre unidades académicas.
#    Retorna lista ordenada por déficit descendente:
#    [{sede, laboratorio, cantidad_disponible, cantidad_requerida, deficit, ratio}]
#    ESTA función detecta la desproporción La Paz (100 estudiantes, 4 balanzas)
#    vs Riberalta (10 estudiantes, 2 balanzas)
#
# 5. detectar_excedentes(laboratorio_id) -> list[dict]:
#    Equipos con pct_uso < 10% O cantidad_disponible > (max_requerido * 2)
#    Candidatos para reordenamiento a otra unidad académica.
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
		# FIX #17: búsqueda por término. Se usa icontains (substring) DELIBERADAMENTE
		# porque la nomenclatura es asimétrica: el nombre teórico de la guía es corto
		# ("BALANZA DIGITAL") y el nombre físico del equipo es una descripción larga
		# ("BALANZA DIGITAL CAP.30 KG..."). Un match exacto daría 0 coincidencias.
		# Se normaliza el término (espacios colapsados) para mayor robustez.
		# Limitación conocida: un término genérico puede agrupar variantes distintas
		# (p. ej. "MICROSCOPIO" → óptico y electrónico). Mientras no exista un
		# catálogo canónico de equipos, esta búsqueda es por coincidencia de texto.
		nombre_equipo_teorico = " ".join((nombre_equipo_teorico or "").split())
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

		if not disponible_by_lab and not demanda_by_lab:
			return []

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
	def obtener_resumen_nacional(cls):
		from django.db.models import F, ExpressionWrapper, IntegerField, Max
		from apps.laboratorios.models import Equipo, EquipoRequeridoPorGuia, Laboratorio

		def _norm(s):
			# Normaliza nombre para agrupar: sin espacios extremos, espacios
			# internos colapsados y en mayúsculas.
			return " ".join((s or "").split()).upper()

		total_equipos = Equipo.objects.count()
		malos_regulares = Equipo.objects.filter(estatus_general__in=['malo', 'regular']).count()
		pct_malo_regular = round((malos_regulares / total_equipos * 100), 2) if total_equipos > 0 else 0

		# Mapa de laboratorios (1 query): id -> (nombre, sede)
		labs_info = {
			lab.id: (lab.nombre, lab.unidad_academica.nombre if lab.unidad_academica_id else None)
			for lab in Laboratorio.objects.select_related('unidad_academica')
		}

		# ── Demanda por (nombre_teórico, lab) y déficit por sede ──────────────
		sedes_deficit = {}
		demanda_por_nombre_lab = {}  # (nombre_norm, lab_id) -> requerido
		reqs = EquipoRequeridoPorGuia.objects.select_related(
			'equipo', 'guia__asignatura'
		).prefetch_related('guia__asignatura__laboratorios__unidad_academica')
		for req in reqs:
			if not req.guia.asignatura:
				continue
			nombre_norm = _norm(req.nombre_equipo_teorico)
			disp_eq = req.equipo.cantidad_disponible() if req.equipo else 0
			for lab in req.guia.asignatura.laboratorios.all():
				key = (nombre_norm, lab.id)
				demanda_por_nombre_lab[key] = (
					demanda_por_nombre_lab.get(key, 0) + req.cantidad_requerida
				)
				if lab.unidad_academica:
					deficit = max(0, req.cantidad_requerida - disp_eq)
					if deficit > 0:
						sede_name = lab.unidad_academica.nombre
						sedes_deficit[sede_name] = sedes_deficit.get(sede_name, 0) + deficit

		top_sedes_deficit = sorted(
			[{"sede": k, "deficit": v} for k, v in sedes_deficit.items()],
			key=lambda x: x["deficit"], reverse=True,
		)[:5]

		# ── Disponibilidad por (nombre, lab), excedentes y distribución ──────
		equipos = Equipo.objects.annotate(
			max_req=Max('guias_que_requieren__cantidad_requerida'),
			disp=ExpressionWrapper(
				F('cantidad_buena') + F('cantidad_regular'), output_field=IntegerField()
			),
		).select_related('laboratorio__unidad_academica')

		total_reasignable = 0
		nombres_con_excedente = set()
		disponible_por_nombre_lab = {}  # (nombre_norm, lab_id) -> disponible
		dist_sedes = {}

		for eq in equipos:
			disp = eq.disp or 0
			max_req = eq.max_req or 0
			nombre_norm = _norm(eq.nombre)
			if eq.laboratorio_id:
				key = (nombre_norm, eq.laboratorio_id)
				disponible_por_nombre_lab[key] = disponible_por_nombre_lab.get(key, 0) + disp
			excedente = max(0, disp - max_req)
			if excedente > 0 and (disp > max_req * 2 or max_req == 0):
				total_reasignable += excedente
				nombres_con_excedente.add(nombre_norm)
			sede = (
				eq.laboratorio.unidad_academica.nombre
				if eq.laboratorio and eq.laboratorio.unidad_academica else "Sin Asignar"
			)
			dist_sedes[sede] = dist_sedes.get(sede, 0) + disp

		# ── Oportunidades: cruce en memoria (FIX #13: elimina el N+1) ────────
		# Antes se llamaba comparar_sedes_para_equipo(nombre) por cada nombre con
		# excedente (~660 llamadas → ~2000 queries). Ahora se indexa una sola vez
		# por nombre y se cruzan en memoria las sedes con excedente vs. déficit del
		# MISMO equipo. El cruce es por nombre normalizado (mismo activo entre
		# sedes), que es semánticamente lo correcto para sugerir reasignaciones.
		por_nombre = {}  # nombre_norm -> {lab_id: [disp, req]}
		for (nombre, lab_id), disp in disponible_por_nombre_lab.items():
			por_nombre.setdefault(nombre, {}).setdefault(lab_id, [0, 0])[0] = disp
		for (nombre, lab_id), req in demanda_por_nombre_lab.items():
			por_nombre.setdefault(nombre, {}).setdefault(lab_id, [0, 0])[1] = req

		oportunidades_reales = []
		for nombre in nombres_con_excedente:
			filas = por_nombre.get(nombre, {})
			con_excedente = [
				(lab_id, d, r) for lab_id, (d, r) in filas.items()
				if d > r * 2 or (r == 0 and d > 0)
			]
			con_deficit = [
				(lab_id, d, r) for lab_id, (d, r) in filas.items() if r - d > 0
			]
			for (lo, d_o, r_o) in con_excedente:
				for (ld, d_d, r_d) in con_deficit:
					if lo == ld:
						continue
					mov = min(d_o - r_o, r_d - d_d)
					if mov > 0:
						lab_o = labs_info.get(lo, (None, None))
						lab_d = labs_info.get(ld, (None, None))
						oportunidades_reales.append({
							"equipo": nombre,
							"origen": lab_o[1],
							"lab_origen": lab_o[0],
							"destino": lab_d[1],
							"lab_destino": lab_d[0],
							"cantidad_sugerida": mov,
						})

		oportunidades_reales.sort(key=lambda x: x["cantidad_sugerida"], reverse=True)
		distribucion = [{"sede": k, "cantidad": v} for k, v in dist_sedes.items() if v > 0]
		distribucion.sort(key=lambda x: x["cantidad"], reverse=True)

		return {
			"kpis": {
				"porcentaje_malo_regular": pct_malo_regular,
				"total_reasignable": total_reasignable,
			},
			"top_sedes_deficit": top_sedes_deficit,
			"distribucion_sedes": distribucion,
			"oportunidades": oportunidades_reales[:5],
		}

	@classmethod
	def uso_equipos_de_laboratorio(cls, laboratorio_id):
		"""Versión por lote de calcular_uso_equipo para todos los equipos del lab.

		FIX #13: antes se llamaba calcular_uso_equipo(equipo_id) en un bucle, y
		cada llamada disparaba varias queries (N+1). Aquí se resuelve con una sola
		query agregada (Count anotado por equipo) + una para el total de prácticas.
		"""
		total_practicas_lab = cls._total_practicas_laboratorio(laboratorio_id)
		equipos = (
			Equipo.objects.filter(laboratorio_id=laboratorio_id)
			.annotate(practicas_uso=Count("guias_que_requieren__guia", distinct=True))
		)

		resultado = []
		for equipo in equipos:
			cantidad_disponible = equipo.cantidad_buena + equipo.cantidad_regular
			pct_uso = 0.0
			if total_practicas_lab > 0:
				pct_uso = round((equipo.practicas_uso / total_practicas_lab) * 100, 2)
			resultado.append({
				"equipo_id": equipo.id,
				"nombre": equipo.nombre,
				"cantidad_disponible": cantidad_disponible,
				"total_practicas_que_usa": equipo.practicas_uso,
				"pct_uso": pct_uso,
				"es_ocioso": pct_uso == 0,
			})
		return resultado

	@classmethod
	def calcular(cls, laboratorio_id):
		cache_key = cls._cache_key(laboratorio_id)
		cached = cache.get(cache_key)
		if cached is not None:
			return cached

		laboratorio = Laboratorio.objects.select_related("unidad_academica").get(
			id=laboratorio_id
		)

		data = {
			"laboratorio_id": laboratorio.id,
			"deficits": cls.calcular_deficit_laboratorio(laboratorio_id),
			"ratio": cls.calcular_ratio_por_estudiantes(laboratorio_id),
			"excedentes": cls.detectar_excedentes(laboratorio_id),
			"uso_equipos": cls.uso_equipos_de_laboratorio(laboratorio_id),
		}

		cache.set(cache_key, data, timeout=cls.CACHE_TTL)
		return data
