import { api } from '../../lib/apiClient';

export interface Categoria {
  id: number;
  nombre: string;
  icono: string;
  totalProductos: number;
}

export interface CategoriaForm {
  nombre: string;
  icono: string;
}

export const categoriasApi = {
  listar: () => api<Categoria[]>('GET', '/categorias'),
  crear: (datos: CategoriaForm) => api<Categoria>('POST', '/categorias', datos),
  editar: (id: number, datos: Partial<CategoriaForm>) =>
    api<Categoria>('PATCH', `/categorias/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/categorias/${id}`),
};
