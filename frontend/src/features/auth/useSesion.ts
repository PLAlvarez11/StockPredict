import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../lib/apiClient';
import { authApi, type Usuario } from './api';

export const CLAVE_SESION = ['sesion'] as const;

export function useSesion() {
  return useQuery<Usuario | null>({
    queryKey: CLAVE_SESION,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await authApi.perfil();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}
