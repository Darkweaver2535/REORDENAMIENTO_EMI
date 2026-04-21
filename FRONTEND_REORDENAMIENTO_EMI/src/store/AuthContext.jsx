import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axiosClient, {
	clearTokens,
	getRefreshToken,
	setTokens,
} from "../api/axiosClient";
import { API_ROUTES } from "../constants/api";

const AuthContext = createContext(null);

const extractTokens = (data = {}) => ({
	access:
		data.access ??
		data.access_token ??
		data.tokens?.access ??
		data.token?.access ??
		null,
	refresh:
		data.refresh ??
		data.refresh_token ??
		data.tokens?.refresh ??
		data.token?.refresh ??
		null,
});

const extractUser = (data = {}) => data.user ?? data.perfil ?? data.profile ?? null;

export function AuthProvider({ children }) {
	const [queryClient] = useState(() => new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				refetchOnWindowFocus: false,
			},
		},
	}));
	const [user, setUser] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;

		const restoreSession = async () => {
			try {
				if (!getRefreshToken()) {
					if (isMounted) {
						setUser(null);
						setIsLoading(false);
					}
					return;
				}

				const response = await axiosClient.get(API_ROUTES.AUTH.PERFIL);

				if (isMounted) {
					setUser(extractUser(response.data));
				}
			} catch {
				clearTokens();

				if (isMounted) {
					setUser(null);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		restoreSession();

		return () => {
			isMounted = false;
		};
	}, []);

	const login = async (carnet_identidad, password) => {
		const response = await axiosClient.post(API_ROUTES.AUTH.LOGIN, {
			carnet_identidad,
			password,
		});

		const data = response.data ?? {};
		const {
			access_token,
			refresh_token,
			id,
			carnet_identidad: carnetIdentidad,
			rol,
			nombre_completo,
			unidad_academica_id,
			unidad_academica_nombre,
		} = data;

		if (!access_token || !refresh_token) {
			throw new Error("No se recibieron tokens validos del backend");
		}

		setTokens(access_token, refresh_token);
		setUser({
			id: id ?? null,
			carnet_identidad: carnetIdentidad ?? carnet_identidad,
			rol: rol?.toLowerCase?.() ?? rol,
			nombre_completo,
			unidad_academica_id,
			unidad_academica_nombre,
		});

		return { success: true };
	};

	const logout = () => {
		clearTokens();
		setUser(null);

		if (typeof window !== "undefined") {
			window.location.href = "/login";
		}
	};

	const hasRole = (...roles) => {
		if (!user?.rol) {
			return false;
		}

		return roles.includes(user.rol);
	};

	const value = useMemo(
		() => ({
			user,
			isAuthenticated: Boolean(user),
			isLoading,
			login,
			logout,
			hasRole,
		}),
		[user, isLoading]
	);

	return (
		<QueryClientProvider client={queryClient}>
			<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
		</QueryClientProvider>
	);
}

export const useAuth = () => {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth debe usarse dentro de AuthProvider");
	}

	return context;
};