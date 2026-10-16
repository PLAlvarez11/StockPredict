import { api } from '../../lib/apiClient';

export type EstadoPrediccion = 'comprar' | 'suficiente' | 'sin_historial';
export type Semaforo = 'rojo' | 'ambar' | 'verde' | 'neutro';
export type FiltroSemaforo = 'todos' | Semaforo;
export type OrigenCalculo = 'producto' | 'subcategoria' | 'categoria';

export interface CalculoDetalle {
  v1: number;
  v2: number;
  v3: number;
  ponderado: number;
  factorTendencia: number;
  factorAjustado: number;
  stockAjustado: number;
  margen: number;
  margenPorCiento: number;
  stockSugerido: number;
  cantidadAComprar: number;
  productosBase: number;
}

export interface ItemPrediccion {
  producto: {
    id: number;
    nombre: string;
    categoria: { id: number; nombre: string; icono: string };
    subcategoria: { id: number; nombre: string; icono: string };
  };
  stockActual: number;
  estado: EstadoPrediccion;
  semaforo: Semaforo;
  origen: OrigenCalculo | null;
  necesidadPct: number | null;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  calculo: CalculoDetalle | null;
}

export interface Prediccion {
  semanasBase: { inicio: string; fin: string }[];
  semanaActual: { inicio: string; fin: string };
  totalActivos: number;
  totalAComprar: number;
  totalFiltrados: number;
  items: ItemPrediccion[];
}

export interface FiltrosPrediccion {
  q?: string | undefined;
  categoriaId?: number | undefined;
  subcategoriaId?: number | undefined;
  estado?: FiltroSemaforo | undefined;
}

export interface SimulacionEntrada {
  categoriaId: number;
  subcategoriaId?: number | undefined;
  nombre?: string | undefined;
  stockActual?: number | undefined;
}

export interface Simulacion {
  nombre: string | null;
  categoria: { id: number; nombre: string };
  subcategoria: { id: number; nombre: string } | null;
  stockActual: number | null;
  estado: 'estimado' | 'sin_historial';
  origen: OrigenCalculo | null;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  necesidadPct: number | null;
  calculo: CalculoDetalle | null;
}

export function consulta(filtros: FiltrosPrediccion): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q);
  if (filtros.categoriaId !== undefined) params.set('categoriaId', String(filtros.categoriaId));
  if (filtros.subcategoriaId !== undefined) {
    params.set('subcategoriaId', String(filtros.subcategoriaId));
  }
  if (filtros.estado && filtros.estado !== 'todos') params.set('estado', filtros.estado);
  const texto = params.toString();
  return texto === '' ? '' : `?${texto}`;
}

export type FormatoExportacion = 'pdf' | 'xlsx' | 'csv';

export const prediccionApi = {
  obtener: (filtros: FiltrosPrediccion = {}) =>
    api<Prediccion>('GET', `/prediccion${consulta(filtros)}`),
  simular: (datos: SimulacionEntrada) => api<Simulacion>('POST', '/prediccion/simulacion', datos),
};
