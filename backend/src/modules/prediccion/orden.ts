export type EstadoPrediccion = 'comprar' | 'suficiente' | 'sin_historial';
export type Semaforo = 'rojo' | 'ambar' | 'verde';

export function necesidadPorcentual(cantidadAComprar: number, stockSugerido: number): number {
  if (!Number.isInteger(cantidadAComprar) || !Number.isInteger(stockSugerido)) {
    throw new RangeError('La necesidad se calcula con enteros');
  }
  if (cantidadAComprar <= 0 || stockSugerido <= 0) return 0;
  const redondeado = Math.floor((200 * cantidadAComprar + stockSugerido) / (2 * stockSugerido));
  return Math.min(100, Math.max(1, redondeado));
}

export function semaforoDe(estado: EstadoPrediccion): Semaforo {
  if (estado === 'comprar') return 'rojo';
  if (estado === 'sin_historial') return 'ambar';
  return 'verde';
}

export interface Ordenable {
  estado: EstadoPrediccion;
  necesidadPct: number | null;
  cantidadAComprar: number | null;
  nombre: string;
}

const GRUPO: Record<EstadoPrediccion, number> = { comprar: 0, suficiente: 1, sin_historial: 2 };

export function compararPredicciones(a: Ordenable, b: Ordenable): number {
  return (
    GRUPO[a.estado] - GRUPO[b.estado] ||
    (b.necesidadPct ?? 0) - (a.necesidadPct ?? 0) ||
    (b.cantidadAComprar ?? 0) - (a.cantidadAComprar ?? 0) ||
    a.nombre.localeCompare(b.nombre, 'es')
  );
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
