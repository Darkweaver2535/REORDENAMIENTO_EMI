# ADR 0001 — Modelo de Equipo (unidad individual) y catálogo canónico de tipos

- Estado: Aceptado
- Fecha: 2026-06-05
- Relacionado: #12 (catálogo canónico), #13 (modelo Equipo)

## Contexto

En la EMI cada equipo de laboratorio se gestiona como un **activo individual**:
tiene su propio código de activo, su estado físico y sus propiedades. Antes el
sistema permitía registrar "un equipo y su cantidad" (modelo de lote), pero esa
forma resultó incorrecta: no permite rastrear el estado por unidad.

Los datos lo confirman: los 744 equipos existentes tienen todos
`cantidad_total = 1` y un `codigo_activo` único.

Por otro lado, la relación entre la demanda teórica de las guías
(`EquipoRequeridoPorGuia.nombre_equipo_teorico`, p. ej. "BALANZA DIGITAL") y los
equipos físicos (`Equipo.nombre`, p. ej. "BALANZA DIGITAL CAP. 30 KG ...") se
resolvía con coincidencia de texto (`icontains`), frágil y ambigua.

## Decisión

### #13 — Equipo es una unidad física individual

- `Equipo` representa **una sola unidad**. `cantidad_total` solo puede ser `0`
  (recién comprado, aún sin recepcionar) o `1`.
- Se valida en el serializer (`EquipoListSerializer.validate_cantidad_total`):
  crear/editar con `cantidad_total > 1` es rechazado.
- Los campos `cantidad_buena/regular/mala` se mantienen por compatibilidad con la
  evaluación in-situ, pero son redundantes con `estatus_general` cuando la unidad
  es individual.

No se añadió un `CheckConstraint` en BD ni se eliminó la lógica de "split de lote"
de reordenamiento todavía, para no romper datos ni flujos en caliente. Esa
limpieza queda como trabajo futuro (la lógica está latente: con unidades
individuales, un traslado siempre mueve la unidad completa).

### #12 — Catálogo canónico de tipos (`TipoEquipo`)

- Nuevo modelo `TipoEquipo` (nombre canónico único, categoría, descripción).
- `Equipo.tipo` y `EquipoRequeridoPorGuia.tipo` son FK opcionales a `TipoEquipo`.
- Backfill heurístico (migración `0009`): se crea un tipo por palabra clave
  inicial del nombre (con manejo de palabras genéricas) y se enlazan los 744
  equipos. Resultado: 268 tipos (p. ej. BALANZA→40, MICROSCOPIO→9).
- El matching de `comparar_sedes_para_equipo` ahora **prefiere la FK `tipo`**
  (exacta) y solo cae a `icontains` cuando el término no resuelve a un tipo.
- API: `GET/POST /api/v1/laboratorios/tipos-equipo/` (lectura para autenticados,
  escritura ADMIN/JEFE) + administración en Django admin.

## Consecuencias

- Las analíticas de déficit y las comparativas entre sedes dejan de depender de
  texto cuando los datos están clasificados por tipo.
- El catálogo inicial es automático e imperfecto: los administradores deben
  **curar y fusionar** tipos (p. ej. unificar "TAMIZ" y "TAMICES") y reasignar
  equipos. Es una tarea de mantenimiento esperada, no un defecto.
- Trabajo futuro: UI de gestión del catálogo en el frontend, y eventual
  eliminación de la lógica de lote en reordenamiento + `CheckConstraint`
  `cantidad_total <= 1` una vez validado en producción.
