import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { CLAVE_PRODUCTOS } from './hooks';

export interface SemanaCompras {
  inicio: string;
  fin: string;
  cantidad: number;
  enCurso: boolean;
}

export interface ComprasProducto {
  semanas: SemanaCompras[];
  total: number;
  semanaMayor: SemanaCompras | null;
}

export function useCompras(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, 'compras', id],
    queryFn: () => api<ComprasProducto>('GET', `/productos/${id as number}/compras`),
    enabled: id !== null,
  });
}
