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

/**
 * Recorre TODAS las páginas de un endpoint paginado y devuelve la lista completa.
 *
 * `page_size: 1000` no significa "todo": el backend topa en max_page_size=1000,
 * así que con 3.369 equipos las pantallas que pedían "todo" se quedaban con el
 * primer millar y los reportes salían calculados sobre un tercio del inventario.
 */
async function fetchTodasLasPaginas(fetcher, params = {}) {
  const PAGE_SIZE = 1000; // máximo que admite el backend
  const items = [];
  let page = 1;

  // El tope de 100 páginas evita un bucle infinito si el backend dejara de
  // avanzar; a 1000 por página cubre 100.000 registros.
  for (let i = 0; i < 100; i += 1) {
    const data = await fetcher({ ...params, page, page_size: PAGE_SIZE });
    const cuerpo = data?.data ?? data;
    const lote = Array.isArray(cuerpo) ? cuerpo : (cuerpo?.results ?? []);
    items.push(...lote);

    // Sin paginación (lista plana) o última página → terminamos.
    if (Array.isArray(cuerpo) || !cuerpo?.next || lote.length === 0) break;
    page += 1;
  }
  return items;
}

/** Inventario completo de equipos, sin truncar por paginación. */
export const fetchTodosLosEquipos = (params) =>
  fetchTodasLasPaginas(fetchEquipos, params);

/** Listado completo de laboratorios, sin truncar por paginación. */
export const fetchTodosLosLaboratorios = (params) =>
  fetchTodasLasPaginas(fetchLaboratorios, params);

export const updateEvaluacionInsitu = (id, payload) =>
  httpClient.patch(API_ENDPOINTS.equipos.evaluacionInSitu(id), payload);

/** Obtiene el árbol completo de laboratorios (solo nodos raíz con hijos anidados). */
export const fetchLaboratoriosTree = () =>
  httpClient.get(API_ENDPOINTS.laboratorios.tree);

/** Analítica de un laboratorio: déficits, ratio, excedentes y uso de equipos (#9). */
export const fetchLaboratorioAnalytics = (id) =>
  httpClient.get(API_ENDPOINTS.laboratorios.analytics(id));
