import httpClient from "./httpClient";
import { API_ROUTES } from "../constants/api";

export const fetchDashboardMetrics = () =>
  httpClient.get(API_ROUTES.DASHBOARD.METRICAS);
