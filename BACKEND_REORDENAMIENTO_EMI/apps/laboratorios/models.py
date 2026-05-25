# App: laboratorios | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 6.x + PostgreSQL
#
# Modelos: Laboratorio (con jerarquía padre-hijo), LaboratorioAsignatura,
#          Equipo, EquipoRequeridoPorGuia
#
# Jerarquía Laboratorio:
#   - clase_nodo: GENERAL (raíz, parent=None) | SUBESPACIO (hijo, parent!=None)
#   - subtipo_espacio: SALA, AREA, SECCION, LABORATORIO (solo para SUBESPACIO)
#   - parent: FK self-referencial (SET_NULL para evitar cascada destructiva)
#   - Los equipos solo se pueden asignar a nodos hoja (sin hijos)
#   - unidad_academica se hereda automáticamente del padre en save()

from django.core.exceptions import ValidationError
from django.db import models

from apps.estructura_academica.models import BaseModel


class Laboratorio(BaseModel):
	# ── Jerarquía ────────────────────────────────────────────────────────────
	class ClaseNodo(models.TextChoices):
		GENERAL    = 'GENERAL',    'General (raíz)'
		SUBESPACIO = 'SUBESPACIO', 'Subespacio (hijo)'

	class SubtipoEspacio(models.TextChoices):
		SALA        = 'SALA',        'Sala'
		AREA        = 'AREA',        'Área'
		SECCION     = 'SECCION',     'Sección'
		LABORATORIO = 'LABORATORIO', 'Laboratorio'

	parent = models.ForeignKey(
		'self',
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name='hijos',
		verbose_name='Espacio padre',
	)
	clase_nodo = models.CharField(
		max_length=20,
		choices=ClaseNodo.choices,
		default=ClaseNodo.GENERAL,
		verbose_name='Clase de nodo',
		help_text='GENERAL para raíces; SUBESPACIO para nodos hijo.',
	)
	subtipo_espacio = models.CharField(
		max_length=20,
		choices=SubtipoEspacio.choices,
		null=True,
		blank=True,
		verbose_name='Subtipo de espacio',
		help_text='Obligatorio para nodos SUBESPACIO; nulo para nodos GENERAL.',
	)

	# ── Identidad / Localización ─────────────────────────────────────────────
	nombre = models.CharField(max_length=150)
	unidad_academica = models.ForeignKey(
		"estructura_academica.UnidadAcademica",
		on_delete=models.PROTECT,
		related_name="laboratorios",
	)
	campus = models.CharField(max_length=100)
	edificio = models.CharField(max_length=50, blank=True)
	piso = models.SmallIntegerField(null=True, blank=True)
	sala = models.CharField(max_length=50, blank=True)
	capacidad_estudiantes = models.IntegerField(default=0)
	is_active = models.BooleanField(default=True)
	asignaturas = models.ManyToManyField(
		"estructura_academica.Asignatura",
		through="LaboratorioAsignatura",
		related_name="laboratorios",
	)

	# ── Campos descriptivos nuevos ───────────────────────────────────────────
	superficie_m2 = models.DecimalField(
		max_digits=8,
		decimal_places=2,
		null=True,
		blank=True,
		verbose_name='Superficie (m²)',
	)
	ubicacion = models.CharField(
		max_length=255,
		blank=True,
		verbose_name='Ubicación',
		help_text='Descripción textual de la ubicación física (ej: "Bloque B, planta baja").',
	)
	norma = models.CharField(
		max_length=255,
		blank=True,
		verbose_name='Norma aplicable',
		help_text='Norma de bioseguridad, calidad o reglamento institucional.',
	)
	actividad_pea = models.TextField(
		blank=True,
		verbose_name='Actividad PEA',
		help_text='Actividades de enseñanza-aprendizaje realizadas en este espacio.',
	)
	actividad_investigacion = models.TextField(
		blank=True,
		verbose_name='Actividad de Investigación',
	)
	actividad_servicios = models.TextField(
		blank=True,
		verbose_name='Actividad de Servicios',
	)

	# ── Meta ─────────────────────────────────────────────────────────────────
	class Meta:
		ordering = ["nombre"]
		verbose_name = "Laboratorio"
		verbose_name_plural = "Laboratorios"

	def __str__(self):
		if self.sala:
			return f"{self.nombre} ({self.sala})"
		return self.nombre

	# ── Helpers ──────────────────────────────────────────────────────────────
	def es_hoja(self):
		"""Retorna True si este nodo no tiene hijos (puede recibir equipos)."""
		return not self.hijos.exists()

	# ── Ciclo de vida ────────────────────────────────────────────────────────
	def save(self, *args, **kwargs):
		"""Auto-hereda unidad_academica del padre si no fue proporcionada."""
		if self.parent_id and not self.unidad_academica_id:
			try:
				parent = Laboratorio.objects.get(pk=self.parent_id)
				self.unidad_academica_id = parent.unidad_academica_id
			except Laboratorio.DoesNotExist:
				pass
		super().save(*args, **kwargs)

	def clean(self):
		super().clean()

		# ── Regla 1: nodo raíz → clase_nodo debe ser GENERAL
		if self.parent_id is None:
			if self.clase_nodo != self.ClaseNodo.GENERAL:
				raise ValidationError({
					'clase_nodo': 'Un nodo raíz (sin padre) debe tener clase_nodo = GENERAL.'
				})
		else:
			# ── Regla 2: nodo hijo → clase_nodo debe ser SUBESPACIO
			if self.clase_nodo != self.ClaseNodo.SUBESPACIO:
				raise ValidationError({
					'clase_nodo': 'Un nodo hijo (con padre) debe tener clase_nodo = SUBESPACIO.'
				})

			# ── Regla 3: hijo debe compartir unidad_academica con el padre
			try:
				padre = Laboratorio.objects.get(pk=self.parent_id)
			except Laboratorio.DoesNotExist:
				raise ValidationError({'parent': 'El laboratorio padre no existe.'})

			# unidad_academica_id puede venir de herencia (puede no estar seteado aún)
			ua_hijo = self.unidad_academica_id or padre.unidad_academica_id
			if ua_hijo and padre.unidad_academica_id and ua_hijo != padre.unidad_academica_id:
				raise ValidationError({
					'unidad_academica': (
						'El nodo hijo debe pertenecer a la misma unidad académica que su padre '
						f'({padre.unidad_academica}).'
					)
				})

			# ── Regla 4: prevenir ciclos en la jerarquía ─────────────────────
			# Un nodo no puede ser su propio padre (directo) ni antecesor (indirecto).
			if self.pk is not None:
				# Caso 1: self-referencia directa
				if self.parent_id == self.pk:
					raise ValidationError({
						'parent': 'Un laboratorio no puede ser su propio padre.'
					})
				# Caso 2: ciclo indirecto — recorremos la cadena de ancestros
				visitados = set()
				cursor_id = self.parent_id
				while cursor_id is not None:
					if cursor_id == self.pk:
						raise ValidationError({
							'parent': (
								'Asignar este padre crearía un ciclo en la jerarquía. '
								'Verifica que el nodo padre no sea descendiente de este laboratorio.'
							)
						})
					if cursor_id in visitados:
						# Ciclo preexistente en datos (no debería ocurrir en BD sana)
						break
					visitados.add(cursor_id)
					try:
						cursor_id = Laboratorio.objects.values_list('parent_id', flat=True).get(pk=cursor_id)
					except Laboratorio.DoesNotExist:
						break


class LaboratorioAsignatura(BaseModel):
	laboratorio = models.ForeignKey(
		Laboratorio,
		on_delete=models.CASCADE,
		related_name="laboratorio_asignaturas",
	)
	asignatura = models.ForeignKey(
		"estructura_academica.Asignatura",
		on_delete=models.CASCADE,
		related_name="asignatura_laboratorios",
	)

	class Meta:
		ordering = ["laboratorio", "asignatura"]
		verbose_name = "Laboratorio y asignatura"
		verbose_name_plural = "Laboratorios y asignaturas"
		unique_together = (("laboratorio", "asignatura"),)

	def __str__(self):
		return f"{self.laboratorio.nombre} - {self.asignatura.nombre}"


class Equipo(BaseModel):
	class EstatusGeneral(models.TextChoices):
		BUENO   = "bueno",   "Bueno"
		REGULAR = "regular", "Regular"
		MALO    = "malo",    "Malo"

	nombre = models.CharField(max_length=150)
	codigo_activo = models.CharField(max_length=50, unique=True)
	laboratorio = models.ForeignKey(
		Laboratorio,
		on_delete=models.PROTECT,
		related_name="equipos",
	)
	cantidad_total = models.IntegerField(default=0)
	cantidad_buena = models.IntegerField(default=0)
	cantidad_regular = models.IntegerField(default=0)
	cantidad_mala = models.IntegerField(default=0)
	estatus_general = models.CharField(
		max_length=20,
		choices=EstatusGeneral.choices,
		default=EstatusGeneral.BUENO,
	)
	ubicacion_sala = models.CharField(max_length=100, blank=True)
	observaciones = models.TextField(blank=True)
	evaluado_en = models.DateTimeField(null=True, blank=True)
	evaluado_por = models.ForeignKey(
		"usuarios.Usuario",
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="equipos_evaluados",
	)
	foto_url = models.URLField(
		max_length=500,
		blank=True,
		null=True,
		verbose_name="URL de foto del equipo",
		help_text="Enlace público a imagen alojada en la nube (Drive, S3, Cloudinary, etc.)",
	)
	especificaciones = models.JSONField(
		default=dict,
		blank=True,
		verbose_name="Especificaciones técnicas",
		help_text="Características técnicas del equipo en formato clave-valor",
	)
	notas = models.TextField(
		blank=True,
		null=True,
		verbose_name="Notas adicionales",
		help_text="Observaciones, accesorios incluidos, condiciones especiales",
	)
	requiere_mantenimiento = models.BooleanField(
		default=False,
		verbose_name="Requiere mantenimiento periódico",
		help_text="Activar solo para equipos que requieren mantenimiento o calibración periódica (microscopios, balanzas, etc.)",
	)

	class Meta:
		ordering = ["codigo_activo"]
		verbose_name = "Equipo"
		verbose_name_plural = "Equipos"

	def __str__(self):
		return f"{self.codigo_activo} - {self.nombre} ({self.laboratorio.nombre})"

	def cantidad_disponible(self):
		return self.cantidad_buena + self.cantidad_regular

	def clean(self):
		super().clean()

		# ── Validación 1: consistencia de cantidades
		total_calculado = self.cantidad_buena + self.cantidad_regular + self.cantidad_mala
		if self.cantidad_total != total_calculado:
			raise ValidationError(
				{
					"cantidad_total": (
						"La suma de cantidad_buena, cantidad_regular y cantidad_mala debe ser igual a cantidad_total."
					)
				}
			)

		# ── Validación 2: solo se pueden registrar equipos en nodos hoja
		if self.laboratorio_id:
			try:
				lab = Laboratorio.objects.get(pk=self.laboratorio_id)
			except Laboratorio.DoesNotExist:
				return
			if not lab.es_hoja():
				raise ValidationError({
					'laboratorio': (
						f'El laboratorio "{lab.nombre}" tiene subespacios registrados. '
						'Solo se pueden asignar equipos a nodos hoja (sin hijos).'
					)
				})


class EquipoRequeridoPorGuia(BaseModel):
	guia = models.ForeignKey(
		"guias.Guia",
		on_delete=models.CASCADE,
		related_name="equipos_requeridos",
	)
	nombre_equipo_teorico = models.CharField(max_length=150)
	equipo = models.ForeignKey(
		Equipo,
		null=True,
		blank=True,
		on_delete=models.SET_NULL,
		related_name="guias_que_requieren",
	)
	cantidad_requerida = models.IntegerField(default=1)
	notas = models.TextField(blank=True)

	class Meta:
		ordering = ["guia", "nombre_equipo_teorico"]
		verbose_name = "Equipo requerido por guia"
		verbose_name_plural = "Equipos requeridos por guia"

	def __str__(self):
		return f"{self.guia} - {self.nombre_equipo_teorico}"

	def tiene_deficit(self):
		return self.equipo is not None and self.equipo.cantidad_disponible() < self.cantidad_requerida

	def cantidad_deficit(self):
		if self.equipo is None:
			return self.cantidad_requerida
		return max(0, self.cantidad_requerida - self.equipo.cantidad_disponible())
