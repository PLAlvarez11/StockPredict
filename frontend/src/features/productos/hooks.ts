import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { productosApi, type FiltrosProductos } from './api';

export const CLAVE_PRODUCTOS = ['productos'] as const;

const claveFiltros = (filtros: FiltrosProductos) => [
  filtros.categoriaId ?? 'todas',
  filtros.subcategoriaId ?? 'todas',
  filtros.estado ?? 'activos',
  filtros.q ?? '',
];

export function useProductos(filtros: FiltrosProductos = {}) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, ...claveFiltros(filtros)],
    queryFn: () => productosApi.listar(filtros),
  });
}

export function useProductosPaginados(filtros: FiltrosProductos = {}) {
  const consulta = useInfiniteQuery({
    queryKey: [...CLAVE_PRODUCTOS, 'paginas', ...claveFiltros(filtros)],
    queryFn: ({ pageParam }) => productosApi.listarPagina(filtros, pageParam),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    getNextPageParam: (ultima) =>
      ultima.page * ultima.limit < ultima.total ? ultima.page + 1 : undefined,
  });
  const primera = consulta.data?.pages[0];
  return {
    ...consulta,
    datos: consulta.data?.pages.flatMap((p) => p.datos) ?? [],
    total: primera?.total ?? 0,
    stockBajo: primera?.stockBajo ?? 0,
  };
}

export function useProducto(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE_PRODUCTOS, 'detalle', id],
    queryFn: () => productosApi.obtener(id as number),
    enabled: id !== null,
  });
}
