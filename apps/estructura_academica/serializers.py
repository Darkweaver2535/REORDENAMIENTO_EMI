# App: estructura_academica | Archivo: serializers.py
# Sistema de gestión de laboratorios universitarios - DRF
#
# TAREA: Crear serializers para la navegación jerárquica en cascada:
#
# 1. UnidadAcademicaSerializer: campos id, nombre, ciudad, codigo
#
# 2. DepartamentoSerializer: campos id, nombre, codigo, unidad_academica_id,
#    unidad_academica_nombre (SerializerMethodField)
#
# 3. CarreraSerializer: campos id, nombre, codigo_institucional, departamento_id
#
# 4. SemestreSerializer: campos id, numero, nombre
#
# 5. AsignaturaSerializer: campos id, nombre, codigo_curricular, carrera_id,
#    carrera_nombre, semestre_id, semestre_numero, unidad_academica_id
#
# 6. AsignaturaDetalleSerializer (extiende AsignaturaSerializer):
#    Agrega campos anidados completos de carrera y semestre
#    Se usa cuando se necesita el detalle completo (no en listas)
