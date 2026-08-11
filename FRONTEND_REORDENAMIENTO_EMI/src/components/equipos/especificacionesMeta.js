/**
 * Etiquetas legibles para las claves de `Equipo.especificaciones`.
 *
 * Las claves las escriben los importadores de Excel y son identificadores
 * técnicos (`marca_modelo`, `vida_util_consumida`). Mostrarlas crudas obliga al
 * usuario a adivinar; aquí se traducen y se agrupan según de qué documento
 * oficial provienen, que es la pregunta que se hace quien consulta la ficha.
 */

export const GRUPOS = [
	{
		id: "tecnica",
		titulo: "Ficha técnica del laboratorio",
		descripcion: "Datos reportados por el encargado del laboratorio.",
		claves: [
			["marca_modelo", "Marca y modelo"],
			["especificaciones", "Especificaciones técnicas"],
			["funcionalidad", "Funcionalidad en el laboratorio"],
			["anio_adquisicion", "Año de adquisición"],
			["fecha_adquisicion", "Fecha exacta de adquisición"],
			["nota_adquisicion", "Nota sobre la adquisición"],
		],
	},
	{
		id: "contable",
		titulo: "Padrón de Activos Fijos",
		descripcion: "Datos contables oficiales del bien.",
		claves: [
			["codigo_contable", "Código contable"],
			["grupo_contable", "Grupo contable"],
			["auxiliar", "Auxiliar (tipo institucional)"],
			["responsable", "Responsable"],
			["cargo_responsable", "Cargo del responsable"],
			["oficina_contable", "Oficina asignada"],
			["costo_historico", "Costo histórico (Bs)"],
			["fecha_historico", "Fecha de incorporación"],
			["vida_util_consumida", "Vida útil consumida (años)"],
		],
	},
	{
		id: "trazabilidad",
		titulo: "Trazabilidad de la carga",
		descripcion: "Cómo se registró este bien al importar los Excel.",
		claves: [
			["codigo_origen", "Código tal como venía en el Excel"],
			["codigo_duplicado_en_origen", "Comparte código con otro bien en el Excel"],
			["sin_codigo_de_activo", "El Excel indica que no tiene código"],
			["otra_version_en_origen", "Otra redacción del mismo bien en el Excel"],
		],
	},
];

/** Etiqueta legible de una clave; si es desconocida, se formatea el identificador. */
export function etiquetaDe(clave) {
	for (const grupo of GRUPOS) {
		const encontrada = grupo.claves.find(([k]) => k === clave);
		if (encontrada) return encontrada[1];
	}
	return clave.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Reparte las especificaciones en los grupos definidos, en orden. */
export function agrupar(specs = {}) {
	const usadas = new Set();
	const grupos = GRUPOS.map((g) => ({
		...g,
		filas: g.claves
			.filter(([k]) => {
				const tiene = specs[k] !== undefined && specs[k] !== null && specs[k] !== "";
				if (tiene) usadas.add(k);
				return tiene;
			})
			.map(([k, label]) => [k, label, specs[k]]),
	})).filter((g) => g.filas.length > 0);

	// Cualquier clave no catalogada se muestra igual: nunca se oculta un dato.
	const otras = Object.entries(specs)
		.filter(([k, v]) => !usadas.has(k) && v !== undefined && v !== null && v !== "")
		.map(([k, v]) => [k, etiquetaDe(k), v]);
	if (otras.length) {
		grupos.push({
			id: "otros",
			titulo: "Otros datos",
			descripcion: "",
			filas: otras,
		});
	}
	return grupos;
}

const CAMPOS_VARIANTE = {
	marca: "Marca y modelo",
	espec: "Especificaciones",
	foto: "Foto",
	fecha: "Fecha",
	anio: "Año",
};

/** Formatea el valor para lectura (booleanos, listas con viñetas del Excel). */
export function formatearValor(valor) {
	if (typeof valor === "boolean") return valor ? "Sí" : "No";
	// Algunos bienes vienen repetidos en el Excel con otra redacción; se guarda
	// la variante para no perderla y aquí se muestra en texto legible.
	if (Array.isArray(valor)) return valor.map(formatearValor).join("\n");
	if (valor && typeof valor === "object") {
		return Object.entries(valor)
			.map(([k, v]) => `${CAMPOS_VARIANTE[k] ?? k}: ${formatearValor(v)}`)
			.join(" · ");
	}
	// Los Excel traen un acento agudo suelto al inicio de algunas celdas.
	return String(valor).replace(/^[´`']\s*/, "");
}
