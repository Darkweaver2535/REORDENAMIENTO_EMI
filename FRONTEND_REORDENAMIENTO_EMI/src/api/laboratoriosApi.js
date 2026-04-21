import httpClient from "./httpClient";
import { API_ENDPOINTS } from "../constants/api";

export const fetchLaboratorios = (params) =>
  httpClient.get(API_ENDPOINTS.laboratorios.base, { params });

export const fetchLaboratorioById = (id) =>
  httpClient.get(API_ENDPOINTS.laboratorios.byId(id));

export const createLaboratorio = (payload) =>
  httpClient.post(API_ENDPOINTS.laboratorios.base, payload);

export const updateLaboratorio = (id, payload) =>
  httpClient.put(API_ENDPOINTS.laboratorios.byId(id), payload);

export const deleteLaboratorio = (id) =>
  httpClient.delete(API_ENDPOINTS.laboratorios.byId(id));

export const fetchEquipos = (params) =>
  httpClient.get(API_ENDPOINTS.equipos.base, { params });

export const updateEvaluacionInsitu = (id, payload) =>
  httpClient.patch(API_ENDPOINTS.equipos.evaluacionInSitu(id), payload);
