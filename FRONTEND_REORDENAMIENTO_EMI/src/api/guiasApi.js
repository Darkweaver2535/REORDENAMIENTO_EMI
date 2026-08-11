import axiosClient from "./axiosClient";
import { API_ROUTES } from "../constants/api";

export async function getUnidades() {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.UNIDADES);
	return response.data;
}

export async function getDepartamentos(unidadId) {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.DEPARTAMENTOS, {
		params: { unidad_academica_id: unidadId },
	});
	return response.data;
}

// La unidad importa: una carrera se dicta sólo en algunas sedes (tabla
// CarreraUnidadAcademica). Sin ella el selector listaba las 17 carreras de la
// EMI aunque la sede sólo ofreciera 2.
export async function getCarreras(deptId, unidadId) {
	const response = await axiosClient.get(API_ROUTES.ESTRUCTURA.CARRERAS, {
		params: {
			departamento_id: deptId,
			...(unidadId ? { unidad_academica_id: unidadId } : {}),
		},
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

// El PDF de la guía se sube como archivo, así que el alta y la edición van en
// multipart. Cuando no hay archivo se envía JSON normal.
function comoPayload(data) {
	if (!(data?.pdf_archivo instanceof File)) return { body: data, config: undefined };

	const form = new FormData();
	Object.entries(data).forEach(([clave, valor]) => {
		if (valor === undefined || valor === null || valor === "") return;
		form.append(clave, valor);
	});
	return { body: form, config: { headers: { "Content-Type": "multipart/form-data" } } };
}

export async function crearGuia(data) {
	const { body, config } = comoPayload(data);
	const response = await axiosClient.post(API_ROUTES.GUIAS.BASE, body, config);
	return response.data;
}

export async function editarGuia({ id, data }) {
	const { body, config } = comoPayload(data);
	const response = await axiosClient.patch(API_ROUTES.GUIAS.DETALLE(id), body, config);
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