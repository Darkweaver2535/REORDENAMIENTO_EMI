import { useQuery } from "@tanstack/react-query";
import { fetchLaboratorios } from "../api/laboratoriosApi";

const LABORATORIOS_QUERY_KEY = ["laboratorios"];

export function useLaboratorios(params) {
  return useQuery({
    queryKey: [...LABORATORIOS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await fetchLaboratorios(params);
      return response.data;
    },
  });
}
