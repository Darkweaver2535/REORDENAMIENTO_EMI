import { useMutation } from "@tanstack/react-query";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/authApi";
import { useAppStore } from "../store";

export function useAuth() {
  const { state, setUser, logout: clearSession } = useAppStore();

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (response) => {
      setUser(response.data?.user ?? response.data ?? null);
    },
  });

  const currentUserMutation = useMutation({
    mutationFn: getCurrentUser,
    onSuccess: (response) => {
      setUser(response.data?.user ?? response.data ?? null);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearSession();
    },
  });

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    login: loginMutation.mutateAsync,
    getCurrentUser: currentUserMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginStatus: loginMutation.status,
    logoutStatus: logoutMutation.status,
  };
}
