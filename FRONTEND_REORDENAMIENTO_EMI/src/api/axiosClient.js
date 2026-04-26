import axios from "axios";
import { API_ROUTES, BASE_URL, REQUEST_TIMEOUT_MS } from "../constants/api";

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newAccessToken) => {
	refreshSubscribers.forEach((callback) => callback(newAccessToken));
	refreshSubscribers = [];
};

const subscribeTokenRefresh = (callback) => {
	refreshSubscribers.push(callback);
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
			return new Promise((resolve) => {
				subscribeTokenRefresh((newToken) => {
					originalRequest.headers.Authorization = `Bearer ${newToken}`;
					resolve(axiosClient(originalRequest));
				});
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
			clearTokens();
			redirectToLogin();
			return Promise.reject(refreshError);
		} finally {
			isRefreshing = false;
		}
	}
);

export default axiosClient;