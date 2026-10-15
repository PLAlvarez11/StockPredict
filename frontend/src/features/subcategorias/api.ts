import { api } from '../../lib/apiClient';
import type { FiltroEstado } from '../categorias/api';

export interface Subcategoria {
  id: number;
  categoriaId: number;
  categoriaNombre: string;
  nombre: string;
  icono: string;
  iconoPropio: string | null;
  estado: boolean;
  totalProductos: number;
}

export interface SubcategoriaNueva {
  categoriaId: number;
  nombre: string;
  icono: string | null;
}

export const subcategoriasApi = {
  listar: (categoriaId?: number, estado: FiltroEstado = 'activos', q?: string) =>
    api<Subcategoria[]>(
      'GET',
      `/subcategorias?estado=${estado}${categoriaId === undefined ? '' : `&categoriaId=${categoriaId}`}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  crear: (datos: SubcategoriaNueva) => api<Subcategoria>('POST', '/subcategorias', datos),
  editar: (id: number, datos: { nombre?: string; icono?: string | null }) =>
    api<Subcategoria>('PATCH', `/subcategorias/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/subcategorias/${id}`),
  activar: (id: number) => api<Subcategoria>('POST', `/subcategorias/${id}/activar`),
};
