import { useQuery } from '@tanstack/react-query';
import { productosApi, type FiltrosProductos } from './api';

export const CLAVE_PRODUCTOS = ['productos'] as const;

export function useProductos(filtros: FiltrosProductos = {}) {
  return useQuery({
    queryKey: [
      ...CLAVE_PRODUCTOS,
      filtros.categoriaId ?? 'todas',
      filtros.subcategoriaId ?? 'todas',
      filtros.estado ?? 'activos',
    ],
    queryFn: () => productosApi.listar(filtros),
  });
}

export function useProducto(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, 'detalle', id],
    queryFn: () => productosApi.obtener(id as number),
    enabled: id !== null,
  });
}
