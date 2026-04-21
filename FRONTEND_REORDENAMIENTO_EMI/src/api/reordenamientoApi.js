import httpClient from "./httpClient";
import { API_ENDPOINTS } from "../constants/api";

export const fetchReordenamientos = (params) =>
  httpClient.get(API_ENDPOINTS.reordenamiento.base, { params });

export const fetchReordenamientoById = (id) =>
  httpClient.get(`${API_ENDPOINTS.reordenamiento.base}/${id}`);

export const createReordenamiento = (payload) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.base, payload);

export const updateReordenamiento = (id, payload) =>
  httpClient.put(`${API_ENDPOINTS.reordenamiento.base}/${id}`, payload);

export const deleteReordenamiento = (id) =>
  httpClient.delete(`${API_ENDPOINTS.reordenamiento.base}/${id}`);

export const autorizarReordenamiento = (id) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.autorizar(id));

export const ejecutarReordenamiento = (id) =>
  httpClient.post(API_ENDPOINTS.reordenamiento.ejecutar(id));

export const fetchComparativaSedes = (nombreEquipo) =>
  httpClient.get(API_ENDPOINTS.reordenamiento.comparativaSedes, {
    params: nombreEquipo ? { nombre_equipo: nombreEquipo } : {},
  });
