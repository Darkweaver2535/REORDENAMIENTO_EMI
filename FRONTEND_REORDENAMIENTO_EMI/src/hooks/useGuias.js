import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGuia,
  deleteGuia,
  fetchGuiaById,
  fetchGuias,
  updateGuia,
} from "../api/guiasApi";

const GUIAS_QUERY_KEY = ["guias"];

export function useGuias(params) {
  return useQuery({
    queryKey: [...GUIAS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await fetchGuias(params);
      return response.data;
    },
  });
}

export function useGuia(id) {
  return useQuery({
    queryKey: [...GUIAS_QUERY_KEY, id],
    queryFn: async () => {
      const response = await fetchGuiaById(id);
      return response.data;
    },
    enabled: Boolean(id),
  });
}

export function useGuiaMutations() {
  const queryClient = useQueryClient();

  const invalidateGuias = () => queryClient.invalidateQueries({ queryKey: GUIAS_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: createGuia,
    onSuccess: invalidateGuias,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateGuia(id, payload),
    onSuccess: invalidateGuias,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGuia,
    onSuccess: invalidateGuias,
  });

  return {
    createGuia: createMutation.mutateAsync,
    updateGuia: updateMutation.mutateAsync,
    deleteGuia: deleteMutation.mutateAsync,
  };
}
