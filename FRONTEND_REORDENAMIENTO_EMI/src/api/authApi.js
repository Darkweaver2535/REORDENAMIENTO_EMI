import httpClient from "./httpClient";
import { API_ENDPOINTS } from "../constants/api";

export const login = (payload) =>
  httpClient.post(API_ENDPOINTS.auth.login, payload);

export const logout = () => httpClient.post(API_ENDPOINTS.auth.logout);

export const getCurrentUser = () => httpClient.get(API_ENDPOINTS.auth.me);

const authApi = {
  login,
  logout,
  getCurrentUser,
};

export default authApi;
