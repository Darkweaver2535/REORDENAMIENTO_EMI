/**
 * Mapeo de roles internos → nombres oficiales visibles en la UI.
 * NO modificar las keys — coinciden con los valores del backend.
 */
export const ROLES_DISPLAY = {
	admin:             "DNICYT",
	jefe:              "Responsable de Activos Fijos",
	docente:           "Docente",
	estudiante:        "Estudiante",
	encargado_activos: "Encargado de Laboratorio",
};

/**
 * Devuelve el nombre oficial de un rol para mostrar en la UI.
 * Normaliza a lowercase para tolerancia de case-mismatch.
 * @param {string} rol - Rol interno (ej: "admin", "ADMIN", "jefe")
 * @returns {string} Nombre oficial o el valor original si no hay mapeo
 */
export const getRolDisplay = (rol) => {
	if (!rol) return "—";
	const key = String(rol).toLowerCase().trim();
	return ROLES_DISPLAY[key] ?? rol;
};
