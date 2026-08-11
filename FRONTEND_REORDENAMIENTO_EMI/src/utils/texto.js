/**
 * Comparación de texto para los buscadores de la interfaz.
 *
 * Los nombres que llegan de los Excel están llenos de tildes ("MULTÍMETRO",
 * "FUENTE DE ALIMENTACIÓN", "BAÑO MARÍA") y nadie las escribe al buscar. Con
 * una comparación literal, escribir "multimetro" no encontraba ninguno de los
 * 22 multímetros del inventario. El backend ya busca sin tildes (extensión
 * `unaccent` de PostgreSQL); esto hace lo mismo en los filtros que se resuelven
 * en el navegador.
 */

/** Minúsculas y sin tildes ni diéresis, conservando la eñe como «n». */
export function sinTildes(valor) {
	return String(valor ?? "")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** `true` si `texto` contiene `busqueda`, ignorando tildes y mayúsculas. */
export function contiene(texto, busqueda) {
	return sinTildes(texto).includes(sinTildes(busqueda));
}
