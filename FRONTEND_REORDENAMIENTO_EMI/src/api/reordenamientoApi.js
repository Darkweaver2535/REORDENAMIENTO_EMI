import httpClient from "./httpClient";
import { API_ENDPOINTS } from "../constants/api";

export const fetchReordenamientos = (params) =>
  httpClient.get(API_ENDPOINTS.reordenamiento.base, { params });

export const fetchReordenamientoById = (id) =>
  httpClient.get(API_ENDPOINTS.reordenamiento.byId(id));

/**
 * Crea un nuevo reordenamiento.
 * Si el payload contiene un archivo (documento_respaldo), envía multipart/form-data.
 * En caso contrario, envía JSON normal.
 */
export const createReordenamiento = (payload) => {
  if (payload?.documento_respaldo instanceof File) {
    const form = new FormData();
    Object.entries(payload).forEach(([key, val]) => {
      if (val !== null && val !== undefined && val !== "") {
        form.append(key, val);
      }
    });
    return httpClient.post(API_ENDPOINTS.reordenamiento.base, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
  return httpClient.post(API_ENDPOINTS.reordenamiento.base, payload);
};

export const updateReordenamiento = (id, payload) =>
  httpClient.put(API_ENDPOINTS.reordenamiento.byId(id), payload);

export const deleteReordenamiento = (id) =>
  httpClient.delete(API_ENDPOINTS.reordenamiento.byId(id));

/** Aprueba el reordenamiento (endpoint canónico DNCIT). */
export const aprobarReordenamiento = (id, data = {}) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.aprobar(id), data);

/** Alias legacy — internamente igual que aprobar. */
export const autorizarReordenamiento = (id, data = {}) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.autorizar(id), data);

/** Marca el reordenamiento como EN_TRANSITO. */
export const ejecutarReordenamiento = (id) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.ejecutar(id));

/** Confirma recepción física del equipo (estado final: RECEPCIONADO). */
export const recepcinarReordenamiento = (id, data = {}) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.recepcionar(id), data);

export const fetchComparativaSedes = (nombreEquipo) =>
  httpClient.get(API_ENDPOINTS.reordenamiento.comparativaSedes, {
    params: nombreEquipo ? { nombre_equipo: nombreEquipo } : {},
  });
