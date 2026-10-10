import { api } from '../../lib/apiClient';

export type NivelStock = 'agotado' | 'bajo' | 'ok';

export interface Producto {
  id: number;
  nombre: string;
  stock: number;
  nivelStock: NivelStock;
  categoria: { id: number; nombre: string; icono: string };
}

export interface ListaProductos {
  datos: Producto[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductoNuevo {
  nombre: string;
  categoriaId: number;
  stockInicial: number;
}

export const productosApi = {
  listar: (categoriaId?: number) =>
    api<ListaProductos>(
      'GET',
      `/productos?limit=100${categoriaId === undefined ? '' : `&categoriaId=${categoriaId}`}`,
    ),
  obtener: (id: number) => api<Producto>('GET', `/productos/${id}`),
  crear: (datos: ProductoNuevo) => api<Producto>('POST', '/productos', datos),
  editar: (id: number, datos: { nombre?: string; categoriaId?: number }) =>
    api<Producto>('PATCH', `/productos/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/productos/${id}`),
};
