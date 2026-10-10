import { useQuery } from '@tanstack/react-query';
import { productosApi } from './api';

export const CLAVE_PRODUCTOS = ['productos'] as const;

export function useProductos(categoriaId?: number) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, categoriaId ?? 'todas'],
    queryFn: () => productosApi.listar(categoriaId),
  });
}

export function useProducto(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, 'detalle', id],
    queryFn: () => productosApi.obtener(id as number),
    enabled: id !== null,
  });
}
