// src/store/NotificationContext.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axiosClient from "../api/axiosClient";
import { useAuth } from "./AuthContext";

const POLL_INTERVAL_MS = 60_000; // 60 segundos

const ENDPOINTS = {
	getUnread:     "/api/v1/notificaciones/?leida=false",
	markOne:       (id) => `/api/v1/notificaciones/${id}/marcar-leida/`,
	markAll:       "/api/v1/notificaciones/marcar-todas-leidas/",
};

/* ── Helpers ─────────────────────────────────────────────────── */
const normalizeList = (data) => {
	if (!data) return [];
	const payload = data?.data ?? data;
	if (Array.isArray(payload)) return payload;
	return payload?.results ?? payload?.data ?? [];
};

/* ── Context ─────────────────────────────────────────────────── */
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
	const { isAuthenticated } = useAuth();

	const [notifications, setNotifications] = useState([]);
	const [isLoading, setIsLoading]         = useState(false);
	const [lastFetched, setLastFetched]     = useState(null);

	const intervalRef = useRef(null);

	/* ── Fetch ────────────────────────────────────────────────── */
	const fetchNotifications = useCallback(async () => {
		// No hacer polling si el usuario no está autenticado
		if (!isAuthenticated) return;

		try {
			const response = await axiosClient.get(ENDPOINTS.getUnread);
			setNotifications(normalizeList(response.data));
			setLastFetched(new Date());
		} catch {
			// Falla silenciosa: no interrumpir la UX por un error de polling
		}
	}, [isAuthenticated]);

	/* ── Polling: arrancar/detener según autenticación ────────── */
	useEffect(() => {
		if (!isAuthenticated) {
			// Si el usuario cierra sesión: limpiar estado y parar polling
			setNotifications([]);
			clearInterval(intervalRef.current);
			intervalRef.current = null;
			return;
		}

		// Fetch inmediato al montar / autenticarse
		setIsLoading(true);
		fetchNotifications().finally(() => setIsLoading(false));

		// Polling cada 60 segundos
		intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);

		return () => {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		};
	}, [isAuthenticated, fetchNotifications]);

	/* ── markAsRead(id) ──────────────────────────────────────── */
	const markAsRead = useCallback(async (id) => {
		try {
			await axiosClient.post(ENDPOINTS.markOne(id));
			// Remover de la lista local inmediatamente (optimistic update)
			setNotifications((prev) =>
				prev.filter((n) => (n?.id ?? n?.uuid) !== id)
			);
		} catch {
			// Si falla, el siguiente polling sincronizará el estado
		}
	}, []);

	/* ── markAllAsRead() ─────────────────────────────────────── */
	const markAllAsRead = useCallback(async () => {
		try {
			await axiosClient.post(ENDPOINTS.markAll);
			setNotifications([]);
		} catch {
			// Falla silenciosa
		}
	}, []);

	/* ── Valor expuesto ───────────────────────────────────────── */
	const unreadCount = notifications.length;

	const value = {
		notifications,
		unreadCount,
		isLoading,
		lastFetched,
		markAsRead,
		markAllAsRead,
		refetch: fetchNotifications,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
}

/* ── Hook de consumo ─────────────────────────────────────────── */
export function useNotifications() {
	const ctx = useContext(NotificationContext);

	if (!ctx) {
		throw new Error("useNotifications debe usarse dentro de <NotificationProvider>");
	}

	return ctx;
}
