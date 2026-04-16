# App: laboratorios | Archivo: models.py
# Sistema de gestión de laboratorios universitarios - Django 5.x + PostgreSQL
#
# TAREA: Crear tres modelos para gestionar laboratorios físicos y equipos (activos).
# Todos heredan de BaseModel (created_at, updated_at).
#
# 1. Modelo 'Laboratorio':
#    - nombre: CharField(150) (ej: "Laboratorio de Química")
#    - unidad_academica: ForeignKey('estructura_academica.UnidadAcademica', on_delete=PROTECT)
#    - campus: CharField(100)
#    - edificio: CharField(50) blank=True
#    - piso: SmallIntegerField null=True
#    - sala: CharField(50) (sala específica, ej: "Sala 203-B")
#    - capacidad_estudiantes: IntegerField default=0
#    - is_active: BooleanField(default=True)
#    - asignaturas: ManyToManyField('estructura_academica.Asignatura',
#      through='LaboratorioAsignatura', related_name='laboratorios')
#
# 2. Modelo 'LaboratorioAsignatura' (tabla M2M con datos extra):
#    - laboratorio: ForeignKey(Laboratorio, on_delete=CASCADE)
#    - asignatura: ForeignKey('estructura_academica.Asignatura', on_delete=CASCADE)
#    - unique_together: (laboratorio, asignatura)
#
# 3. Modelo 'Equipo' (activo físico):
#    - nombre: CharField(150)
#    - codigo_activo: CharField(50) UNIQUE (código del sistema de activos universitario)
#    - laboratorio: ForeignKey(Laboratorio, on_delete=PROTECT, related_name='equipos')
#    - cantidad_total: IntegerField(default=0)
#    - cantidad_buena: IntegerField(default=0)
#    - cantidad_regular: IntegerField(default=0)
#    - cantidad_mala: IntegerField(default=0)
#    - estatus_general: CharField choices: BUENO='bueno', REGULAR='regular', MALO='malo'
#    - ubicacion_sala: CharField(100) blank=True (ubicación exacta dentro del laboratorio)
#    - observaciones: TextField blank=True (ej: "le falta la tapa", "guardado en caja 3")
#    - evaluado_en: DateTimeField null=True (cuándo se hizo la última evaluación in-situ)
#    - evaluado_por: ForeignKey('usuarios.Usuario', null=True, blank=True, on_delete=SET_NULL)
#
#    Métodos del modelo Equipo:
#    - cantidad_disponible(): retorna cantidad_buena + cantidad_regular
#      (REGLA: los malos NO cuentan para atender prácticas)
#    - clean(): validar que buena + regular + mala == total (consistencia)
#    - __str__: retorna "{codigo_activo} - {nombre} ({laboratorio.nombre})"
#
# 4. Modelo 'EquipoRequeridoPorGuia' (TABLA PIVOTE CRÍTICA - cruce teórico vs real):
#    - guia: ForeignKey('guias.Guia', on_delete=CASCADE, related_name='equipos_requeridos')
#    - nombre_equipo_teorico: CharField(150)
#      (nombre como aparece en el PDF de la guía, ej: "Manómetro en U")
#    - equipo: ForeignKey(Equipo, null=True, blank=True, on_delete=SET_NULL,
#      related_name='guias_que_requieren')
#      (NULL si aún no se vinculó al activo físico real)
#    - cantidad_requerida: IntegerField(default=1)
#    - notas: TextField blank=True
#
#    Métodos de EquipoRequeridoPorGuia:
#    - tiene_deficit(): retorna True si equipo is not None y
#      equipo.cantidad_disponible() < cantidad_requerida
#    - cantidad_deficit(): retorna max(0, cantidad_requerida - equipo.cantidad_disponible())
#      si equipo is not None, else retorna cantidad_requerida
#
# Incluir Meta con verbose_names en español y ordering apropiado para cada modelo

from django.db import models

# Create your models here.
