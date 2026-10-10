export type NivelStock = 'agotado' | 'bajo' | 'ok';

export function nivelStock(stock: number, umbral: number): NivelStock {
  if (stock <= 0) return 'agotado';
  if (stock <= umbral) return 'bajo';
  return 'ok';
}
