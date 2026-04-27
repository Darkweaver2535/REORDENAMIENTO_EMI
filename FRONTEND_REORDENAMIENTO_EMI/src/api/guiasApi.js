import axiosClient from "./axiosClient";
import { API_ROUTES } from "../constants/api";

export async function getUnidades() {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.UNIDADES);
	return response.data;
}

export async function getDepartamentos(unidadId) {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.DEPARTAMENTOS, {
		params: { unidad_id: unidadId },
	});
	return response.data;
}

export async function getCarreras(deptId) {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.CARRERAS, {
		params: { dept_id: deptId },
	});
	return response.data;
}

export async function getSemestres() {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.SEMESTRES);
	return response.data;
}

export async function getAsignaturas(carreraId, semestreId) {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.ASIGNATURAS, {
		params: {
			carrera_id: carreraId,
			semestre_id: semestreId,
		},
	});
	return response.data;
}

export async function getGuias(asignaturaId) {
	const response = await axiosClient.get(API_ROUTES.GUIAS.BASE, {
		params: { asignatura_id: asignaturaId },
	});
	return response.data;
}

export async function getGuiaDetalle(id) {
	const response = await axiosClient.get(API_ROUTES.GUIAS.DETALLE(id));
	return response.data;
}

export async function crearGuia(data) {
	const response = await axiosClient.post(API_ROUTES.GUIAS.BASE, data);
	return response.data;
}

export async function editarGuia({ id, data }) {
	const response = await axiosClient.patch(API_ROUTES.GUIAS.DETALLE(id), data);
	return response.data;
}

export async function solicitarAprobacion(id) {
	const response = await axiosClient.post(API_ROUTES.GUIAS.SOLICITAR_APROBACION(id));
	return response.data;
}

export async function publicarGuia(id, resolucion_numero) {
	const response = await axiosClient.post(API_ROUTES.GUIAS.PUBLICAR(id), {
		resolucion_numero,
	});
	return response.data;
}

export async function rechazarGuia(id, motivo_rechazo) {
	const response = await axiosClient.post(API_ROUTES.GUIAS.RECHAZAR(id), {
		motivo_rechazo,
	});
	return response.data;
}

export async function cambiarEstadoGuia({ id, estado }) {
	const response = await axiosClient.patch(`${API_ROUTES.GUIAS.BASE}${id}/cambiar-estado/`, {
		estado,
	});
	return response.data;
}