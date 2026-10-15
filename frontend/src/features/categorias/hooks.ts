import { useQuery } from '@tanstack/react-query';
import { categoriasApi, type FiltroEstado } from './api';

export const CLAVE_CATEGORIAS = ['categorias'] as const;

export function useCategorias(estado: FiltroEstado = 'activos', q?: string) {
  return useQuery({
    queryKey: [...CLAVE_CATEGORIAS, estado, q ?? ''],
    queryFn: () => categoriasApi.listar(estado, q),
  });
}
