import { api } from '../../lib/apiClient';
import type { FiltroEstado } from '../categorias/api';

export type NivelStock = 'agotado' | 'bajo' | 'ok';

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  stock: number;
  estado: boolean;
  nivelStock: NivelStock;
  categoria: { id: number; nombre: string; icono: string };
  subcategoria: { id: number; nombre: string; icono: string };
}

export interface ListaProductos {
  datos: Producto[];
  total: number;
  stockBajo: number;
  page: number;
  limit: number;
}

export interface ProductoNuevo {
  nombre: string;
  subcategoriaId: number;
  descripcion: string | null;
  estado: boolean;
  stockInicial: number;
}

export interface FiltrosProductos {
  categoriaId?: number | undefined;
  subcategoriaId?: number | undefined;
  estado?: FiltroEstado | undefined;
}

export const productosApi = {
  listar: ({ categoriaId, subcategoriaId, estado = 'activos' }: FiltrosProductos = {}) =>
    api<ListaProductos>(
      'GET',
      `/productos?limit=100&estado=${estado}${categoriaId === undefined ? '' : `&categoriaId=${categoriaId}`}${subcategoriaId === undefined ? '' : `&subcategoriaId=${subcategoriaId}`}`,
    ),
  obtener: (id: number) => api<Producto>('GET', `/productos/${id}`),
  crear: (datos: ProductoNuevo) => api<Producto>('POST', '/productos', datos),
  editar: (
    id: number,
    datos: { nombre?: string; subcategoriaId?: number; descripcion?: string | null },
  ) => api<Producto>('PATCH', `/productos/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/productos/${id}`),
  activar: (id: number) => api<Producto>('POST', `/productos/${id}/activar`),
};
