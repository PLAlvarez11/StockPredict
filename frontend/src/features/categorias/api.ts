import { api } from '../../lib/apiClient';

export type FiltroEstado = 'activos' | 'inactivos' | 'todos';

export interface Categoria {
  id: number;
  nombre: string;
  icono: string;
  estado: boolean;
  totalSubcategorias: number;
  totalProductos: number;
}

export interface CategoriaForm {
  nombre: string;
  icono: string;
}

export const categoriasApi = {
  listar: (estado: FiltroEstado = 'activos') =>
    api<Categoria[]>('GET', `/categorias?estado=${estado}`),
  crear: (datos: CategoriaForm) => api<Categoria>('POST', '/categorias', datos),
  editar: (id: number, datos: Partial<CategoriaForm>) =>
    api<Categoria>('PATCH', `/categorias/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/categorias/${id}`),
  activar: (id: number) => api<Categoria>('POST', `/categorias/${id}/activar`),
};
