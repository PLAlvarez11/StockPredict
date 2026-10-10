export interface EntradaPts {
  v1: number;
  v2: number;
  v3: number;
  divisor?: number;
}

export interface ResultadoPts {
  v1: number;
  v2: number;
  v3: number;
  ponderado: number;
  factorTendencia: number;
  factorAjustado: number;
  stockAjustado: number;
  margen: number;
  stockSugerido: number;
}

export const PESO_V1 = 0.5;
export const PESO_V2 = 0.3;
export const PESO_V3 = 0.2;
export const SENSIBILIDAD = 0.5;
export const MARGEN_SEGURIDAD = 0.2;

function dividirHaciaArriba(numerador: bigint, denominador: bigint): bigint {
  return (numerador + denominador - 1n) / denominador;
}

export function calcularPts({ v1, v2, v3, divisor = 1 }: EntradaPts): ResultadoPts {
  for (const valor of [v1, v2, v3, divisor]) {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new RangeError('Las ventas deben ser enteros no negativos');
    }
  }
  if (divisor === 0) throw new RangeError('El divisor debe ser mayor que cero');

  const a = BigInt(v1);
  const b = BigInt(v2);
  const c = BigInt(v3);
  const n = BigInt(divisor);

  const sugerido =
    b === 0n
      ? dividirHaciaArriba(6n * (5n * a + 2n * c), 50n * n)
      : dividirHaciaArriba(6n * (5n * a + 3n * b + 2n * c) * (a + b), 100n * n * b);

  const e1 = v1 / divisor;
  const e2 = v2 / divisor;
  const e3 = v3 / divisor;
  const ponderado = PESO_V1 * e1 + PESO_V2 * e2 + PESO_V3 * e3;
  const factorTendencia = v2 === 0 ? 1 : v1 / v2;
  const factorAjustado = 1 + (factorTendencia - 1) * SENSIBILIDAD;

  return {
    v1: e1,
    v2: e2,
    v3: e3,
    ponderado,
    factorTendencia,
    factorAjustado,
    stockAjustado: ponderado * factorAjustado,
    margen: MARGEN_SEGURIDAD,
    stockSugerido: Number(sugerido),
  };
}

export function cantidadAComprar(stockSugerido: number, stockActual: number): number {
  return Math.max(stockSugerido - stockActual, 0);
}
