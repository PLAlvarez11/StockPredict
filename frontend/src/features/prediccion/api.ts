import { api } from '../../lib/apiClient';

export type EstadoPrediccion = 'comprar' | 'suficiente' | 'sin_historial';

export interface CalculoDetalle {
  v1: number;
  v2: number;
  v3: number;
  ponderado: number;
  factorTendencia: number;
  factorAjustado: number;
  stockAjustado: number;
  margen: number;
  stockSugerido: number;
  cantidadAComprar: number;
  productosBase: number;
}

export interface ItemPrediccion {
  producto: {
    id: number;
    nombre: string;
    categoria: { id: number; nombre: string; icono: string };
  };
  stockActual: number;
  estado: EstadoPrediccion;
  origen: 'producto' | 'categoria' | null;
  stockSugerido: number | null;
  cantidadAComprar: number | null;
  calculo: CalculoDetalle | null;
}

export interface Prediccion {
  semanasBase: { inicio: string; fin: string }[];
  totalActivos: number;
  totalAComprar: number;
  items: ItemPrediccion[];
}

export const prediccionApi = {
  obtener: () => api<Prediccion>('GET', '/prediccion'),
};
