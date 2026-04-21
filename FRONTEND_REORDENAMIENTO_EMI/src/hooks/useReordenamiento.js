import { useQuery } from "@tanstack/react-query";
import { fetchReordenamientos } from "../api/reordenamientoApi";

const REORDENAMIENTO_QUERY_KEY = ["reordenamiento"];

export function useReordenamiento(params) {
  return useQuery({
    queryKey: [...REORDENAMIENTO_QUERY_KEY, params],
    queryFn: async () => {
      const response = await fetchReordenamientos(params);
      return response.data;
    },
  });
}
