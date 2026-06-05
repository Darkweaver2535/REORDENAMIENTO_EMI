/**
 * axiosClient — cliente HTTP centralizado con refresco automático de JWT.
 *
 * ⚠️  AVISO DE SEGURIDAD (XSS / localStorage):
 *  Los tokens JWT se guardan en localStorage, que es accesible desde cualquier
 *  script JavaScript que se ejecute en la página. Esto significa que un ataque
 *  XSS exitoso podría robar los tokens y hacerse pasar por el usuario.
 *
 *  MITIGACIÓN APLICADA:
 *   - El access token tiene vida corta (8 h configuradas en settings.py).
 *   - Se sanitizan todas las entradas de usuario antes de renderizarlas.
 *   - Se aplica una Content-Security-Policy restrictiva en el servidor web.
 *
 *  PENDIENTE PARA PRODUCCIÓN:
 *   Migrar a cookies httpOnly + SameSite=Strict, que el navegador no expone a JS.
 *   Requiere:
 *     1. Backend: endpoint /auth/token/cookie/ que devuelva Set-Cookie httpOnly.
 *     2. Backend: middleware CSRF habilitado para mutaciones.
 *     3. Frontend: eliminar setTokens/getAccessToken/getRefreshToken y confiar
 *        en que el navegador envíe la cookie automáticamente.
 *   Ver issue pendiente: "Migrar JWT a httpOnly cookies".
 */
import axios from "axios";
import { API_ROUTES, BASE_URL, REQUEST_TIMEOUT_MS } from "../constants/api";

let isRefreshing = false;
let refreshSubscribers = [];

// Notifica a los requests encolados que ya hay un token nuevo (refresh exitoso).
const onRefreshed = (newAccessToken) => {
	refreshSubscribers.forEach(({ resolve }) => resolve(newAccessToken));
	refreshSubscribers = [];
};

// Rechaza todos los requests encolados (refresh fallido → sesión expirada).
const onRefreshFailed = (error) => {
	refreshSubscribers.forEach(({ reject }) => reject(error));
	refreshSubscribers = [];
};

const subscribeTokenRefresh = (resolve, reject) => {
	refreshSubscribers.push({ resolve, reject });
};

const redirectToLogin = () => {
	if (typeof window !== "undefined") {
		window.location.href = "/login";
	}
};

export const setTokens = (access, refresh) => {
	if (typeof window !== "undefined") {
		if (access) localStorage.setItem("access_token", access);
		if (refresh) localStorage.setItem("refresh_token", refresh);
	}
};

export const clearTokens = () => {
	if (typeof window !== "undefined") {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
	}
};

export const getAccessToken = () => {
	return typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
};

export const getRefreshToken = () => {
	return typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
};

const axiosClient = axios.create({
	baseURL: BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: REQUEST_TIMEOUT_MS,
});

axiosClient.interceptors.request.use(
	(config) => {
		const token = getAccessToken();

		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		return config;
	},
	(error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		const status = error.response?.status;
		const requestUrl = originalRequest?.url ?? "";

		if (!originalRequest || status !== 401 || originalRequest._retry) {
			return Promise.reject(error);
		}

		const isLoginRequest = requestUrl.includes("/auth/login/");
		const isRefreshRequest = requestUrl.includes("/auth/token/refresh/");

		if (isLoginRequest || isRefreshRequest) {
			return Promise.reject(error);
		}

		if (!getRefreshToken()) {
			clearTokens();
			redirectToLogin();
			return Promise.reject(error);
		}

		originalRequest._retry = true;

		if (isRefreshing) {
			// FIX #12: la promesa ahora puede resolverse O rechazarse;
			// antes solo tenía resolve → quedaba colgada si el refresh fallaba.
			return new Promise((resolve, reject) => {
				subscribeTokenRefresh(
					(newToken) => {
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						resolve(axiosClient(originalRequest));
					},
					(err) => reject(err),
				);
			});
		}

		isRefreshing = true;

		try {
			const refreshResponse = await axios.post(
				API_ROUTES.AUTH.REFRESH,
				{ refresh: getRefreshToken() },
				{
					headers: { "Content-Type": "application/json" },
					timeout: REQUEST_TIMEOUT_MS,
				}
			);

			const newAccess = refreshResponse.data?.access_token || refreshResponse.data?.access;

			if (!newAccess) {
				throw new Error("Refresh response does not contain access token");
			}

			setTokens(newAccess, getRefreshToken());
			onRefreshed(newAccess);
			originalRequest.headers.Authorization = `Bearer ${newAccess}`;

			return axiosClient(originalRequest);
		} catch (refreshError) {
			// FIX #12: rechazar también los requests encolados antes de redirigir.
			onRefreshFailed(refreshError);
			clearTokens();
			redirectToLogin();
			return Promise.reject(refreshError);
		} finally {
			isRefreshing = false;
		}
	}
);

export default axiosClient;