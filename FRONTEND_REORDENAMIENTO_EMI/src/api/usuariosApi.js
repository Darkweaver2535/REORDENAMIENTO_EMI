import httpClient from "./httpClient";
import { API_ROUTES } from "../constants/api";

export const fetchUsuarios = (params) =>
  httpClient.get(API_ROUTES.USUARIOS.BASE, { params });

export const fetchUsuarioById = (id) =>
  httpClient.get(API_ROUTES.USUARIOS.DETALLE(id));

export const updateUsuario = (id, payload) =>
  httpClient.patch(API_ROUTES.USUARIOS.DETALLE(id), payload);

/** Bitácora de auditoría (#10). Filtros: accion, tabla_afectada, usuario, search, page. */
export const fetchAuditoria = (params) =>
  httpClient.get(API_ROUTES.USUARIOS.AUDITORIA, { params });
