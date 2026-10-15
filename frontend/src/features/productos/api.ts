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
  q?: string | undefined;
}

const LIMITE_PAGINA = 100;

function rutaListado(filtros: FiltrosProductos, pagina: number): string {
  const params = new URLSearchParams({
    limit: String(LIMITE_PAGINA),
    estado: filtros.estado ?? 'activos',
  });
  if (filtros.categoriaId !== undefined) params.set('categoriaId', String(filtros.categoriaId));
  if (filtros.subcategoriaId !== undefined) {
    params.set('subcategoriaId', String(filtros.subcategoriaId));
  }
  if (filtros.q) params.set('q', filtros.q);
  params.set('page', String(pagina));
  return `/productos?${params.toString()}`;
}

export const productosApi = {
  listarPagina: (filtros: FiltrosProductos, pagina: number) =>
    api<ListaProductos>('GET', rutaListado(filtros, pagina)),
  listar: async (filtros: FiltrosProductos = {}) => {
    const primera = await api<ListaProductos>('GET', rutaListado(filtros, 1));
    const datos = [...primera.datos];
    for (let pagina = 2; datos.length < primera.total; pagina += 1) {
      const siguiente = await api<ListaProductos>('GET', rutaListado(filtros, pagina));
      if (siguiente.datos.length === 0) break;
      datos.push(...siguiente.datos);
    }
    return { ...primera, datos };
  },
  obtener: (id: number) => api<Producto>('GET', `/productos/${id}`),
  crear: (datos: ProductoNuevo) => api<Producto>('POST', '/productos', datos),
  editar: (
    id: number,
    datos: { nombre?: string; subcategoriaId?: number; descripcion?: string | null },
  ) => api<Producto>('PATCH', `/productos/${id}`, datos),
  inactivar: (id: number) => api<void>('DELETE', `/productos/${id}`),
  activar: (id: number) => api<Producto>('POST', `/productos/${id}/activar`),
};
