import { useQuery } from '@tanstack/react-query';
import type { FiltroEstado } from '../categorias/api';
import { subcategoriasApi } from './api';

export const CLAVE_SUBCATEGORIAS = ['subcategorias'] as const;

export function useSubcategorias(categoriaId?: number, estado: FiltroEstado = 'activos') {
  return useQuery({
    queryKey: [...CLAVE_SUBCATEGORIAS, categoriaId ?? 'todas', estado],
    queryFn: () => subcategoriasApi.listar(categoriaId, estado),
  });
}
