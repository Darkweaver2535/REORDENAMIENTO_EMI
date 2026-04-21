import httpClient from "./httpClient";
import { API_ROUTES } from "../constants/api";

export const fetchConfiguracion = () =>
  httpClient.get(API_ROUTES.CONFIGURACION.BASE);

export const updateConfiguracion = (payload) =>
  httpClient.patch(API_ROUTES.CONFIGURACION.BASE, payload);
