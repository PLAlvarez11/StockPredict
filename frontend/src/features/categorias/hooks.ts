import { useQuery } from '@tanstack/react-query';
import { categoriasApi } from './api';

export const CLAVE_CATEGORIAS = ['categorias'] as const;

export function useCategorias() {
  return useQuery({ queryKey: CLAVE_CATEGORIAS, queryFn: categoriasApi.listar });
}
