import { describe, expect, it } from 'vitest';
import { calcularPts, cantidadAComprar } from './pts.js';

interface Fraccion {
  n: bigint;
  d: bigint;
}

const fr = (n: number | bigint, d: number | bigint = 1): Fraccion => ({
  n: BigInt(n),
  d: BigInt(d),
});
const suma = (x: Fraccion, y: Fraccion): Fraccion => ({ n: x.n * y.d + y.n * x.d, d: x.d * y.d });
const resta = (x: Fraccion, y: Fraccion): Fraccion => suma(x, { n: -y.n, d: y.d });
const mult = (x: Fraccion, y: Fraccion): Fraccion => ({ n: x.n * y.n, d: x.d * y.d });
const div = (x: Fraccion, y: Fraccion): Fraccion => ({ n: x.n * y.d, d: x.d * y.n });
const techo = (x: Fraccion): bigint => (x.n + x.d - 1n) / x.d;

function referencia(v1: number, v2: number, v3: number, divisor = 1, margen = 20): number {
  const d = fr(divisor);
  const [a, b, c] = [div(fr(v1), d), div(fr(v2), d), div(fr(v3), d)];
  const pp = suma(suma(mult(a, fr(5, 10)), mult(b, fr(3, 10))), mult(c, fr(2, 10)));
  const factor = v2 === 0 ? fr(1) : div(fr(v1), fr(v2));
  const ajustado = suma(fr(1), mult(resta(factor, fr(1)), fr(1, 2)));
  return Number(techo(mult(mult(pp, ajustado), suma(fr(1), fr(margen, 100)))));
}

describe('calcularPts', () => {
  it('ejemplo del DAD: V1=8, V2=6, V3=5, stock 3 → sugerido 10, comprar 7', () => {
    const r = calcularPts({ v1: 8, v2: 6, v3: 5 });
    expect(r.ponderado).toBeCloseTo(6.8, 10);
    expect(r.factorTendencia).toBeCloseTo(8 / 6, 10);
    expect(r.factorAjustado).toBeCloseTo(1.1667, 4);
    expect(r.stockAjustado).toBeCloseTo(7.9333, 4);
    expect(r.margen).toBe(0.2);
    expect(r.stockSugerido).toBe(10);
    expect(cantidadAComprar(r.stockSugerido, 3)).toBe(7);
  });

  it('promedio ponderado con distintos valores', () => {
    expect(calcularPts({ v1: 10, v2: 0, v3: 0 }).ponderado).toBeCloseTo(5, 10);
    expect(calcularPts({ v1: 0, v2: 10, v3: 0 }).ponderado).toBeCloseTo(3, 10);
    expect(calcularPts({ v1: 0, v2: 0, v3: 10 }).ponderado).toBeCloseTo(2, 10);
  });

  it('tendencia al alza aumenta el factor ajustado', () => {
    const r = calcularPts({ v1: 12, v2: 6, v3: 6 });
    expect(r.factorTendencia).toBe(2);
    expect(r.factorAjustado).toBeCloseTo(1.5, 10);
  });

  it('tendencia a la baja reduce el factor ajustado', () => {
    const r = calcularPts({ v1: 3, v2: 6, v3: 6 });
    expect(r.factorTendencia).toBe(0.5);
    expect(r.factorAjustado).toBeCloseTo(0.75, 10);
  });

  it('V2 = 0 usa factor 1 y no divide entre cero', () => {
    const r = calcularPts({ v1: 5, v2: 0, v3: 3 });
    expect(r.factorTendencia).toBe(1);
    expect(r.factorAjustado).toBe(1);
    expect(r.ponderado).toBeCloseTo(3.1, 10);
    expect(r.stockSugerido).toBe(4);
  });

  it('semanas sin ventas cuentan como 0', () => {
    expect(calcularPts({ v1: 0, v2: 0, v3: 0 }).stockSugerido).toBe(0);
    expect(calcularPts({ v1: 0, v2: 4, v3: 4 }).stockSugerido).toBe(2);
  });

  it('el margen de seguridad se aplica sobre el stock ajustado', () => {
    const r = calcularPts({ v1: 10, v2: 10, v3: 10 });
    expect(r.stockAjustado).toBeCloseTo(10, 10);
    expect(r.stockSugerido).toBe(12);
  });

  it('redondea hacia arriba y no sube cuando el resultado ya es entero', () => {
    expect(calcularPts({ v1: 10, v2: 10, v3: 10 }).stockSugerido).toBe(12);
    expect(calcularPts({ v1: 5, v2: 5, v3: 5 }).stockSugerido).toBe(6);
    expect(calcularPts({ v1: 1, v2: 1, v3: 1 }).stockSugerido).toBe(2);
  });

  it('coincide con la referencia racional en toda la rejilla 0..14 de ventas', () => {
    for (let v1 = 0; v1 <= 14; v1 += 1) {
      for (let v2 = 0; v2 <= 14; v2 += 1) {
        for (let v3 = 0; v3 <= 14; v3 += 1) {
          expect(calcularPts({ v1, v2, v3 }).stockSugerido, `${v1}/${v2}/${v3}`).toBe(
            referencia(v1, v2, v3),
          );
        }
      }
    }
  });

  it('con divisor (promedio por producto de la categoría) coincide con la referencia racional', () => {
    for (const divisor of [2, 3, 4, 7]) {
      for (let v1 = 0; v1 <= 12; v1 += 1) {
        for (let v2 = 0; v2 <= 12; v2 += 1) {
          for (let v3 = 0; v3 <= 12; v3 += 3) {
            expect(
              calcularPts({ v1, v2, v3, divisor }).stockSugerido,
              `${v1}/${v2}/${v3}÷${divisor}`,
            ).toBe(referencia(v1, v2, v3, divisor));
          }
        }
      }
    }
  });

  it('sin tope de tendencia: V1=100 y V2=1 produce un sugerido muy alto', () => {
    const r = calcularPts({ v1: 100, v2: 1, v3: 1 });
    expect(r.factorAjustado).toBeCloseTo(50.5, 10);
    expect(r.stockSugerido).toBe(referencia(100, 1, 1));
  });

  it('rechaza entradas inválidas', () => {
    expect(() => calcularPts({ v1: -1, v2: 0, v3: 0 })).toThrow(RangeError);
    expect(() => calcularPts({ v1: 1.5, v2: 0, v3: 0 })).toThrow(RangeError);
    expect(() => calcularPts({ v1: 1, v2: 1, v3: 1, divisor: 0 })).toThrow(RangeError);
  });
});

describe('cantidadAComprar', () => {
  it('es la diferencia cuando el sugerido supera el stock', () => {
    expect(cantidadAComprar(10, 3)).toBe(7);
  });
  it('es cero cuando el stock iguala o supera al sugerido', () => {
    expect(cantidadAComprar(10, 10)).toBe(0);
    expect(cantidadAComprar(10, 15)).toBe(0);
  });
});

describe('PTS v1.1: margen de seguridad según el origen del cálculo', () => {
  it('PR09: sin indicar margen se usa 20 % y el resultado informa el margen usado', () => {
    const r = calcularPts({ v1: 8, v2: 6, v3: 5 });
    expect(r.margenPorCiento).toBe(20);
    expect(r.margen).toBe(0.2);
    expect(r.stockSugerido).toBe(10);
    expect(calcularPts({ v1: 8, v2: 6, v3: 5, margenPorCiento: 20 })).toEqual(r);
  });

  it('PR09: Blusa floral (8, 6, 5) con 20 % da sugerido 10 y comprar 7; con 10 % da 9', () => {
    const propio = calcularPts({ v1: 8, v2: 6, v3: 5, margenPorCiento: 20 });
    expect(propio.stockSugerido).toBe(10);
    expect(cantidadAComprar(propio.stockSugerido, 3)).toBe(7);
    const respaldo = calcularPts({ v1: 8, v2: 6, v3: 5, margenPorCiento: 10 });
    expect(respaldo.margenPorCiento).toBe(10);
    expect(respaldo.margen).toBe(0.1);
    expect(respaldo.stockSugerido).toBe(9);
  });

  it('PR09: el margen de 10 % es más prudente: nunca supera al de 20 %', () => {
    for (let v1 = 0; v1 <= 12; v1 += 1) {
      for (let v2 = 0; v2 <= 12; v2 += 1) {
        const chico = calcularPts({ v1, v2, v3: 4, margenPorCiento: 10 }).stockSugerido;
        const grande = calcularPts({ v1, v2, v3: 4, margenPorCiento: 20 }).stockSugerido;
        expect(chico).toBeLessThanOrEqual(grande);
      }
    }
  });

  it('PR09: con margen de 10 % coincide con la referencia racional, con y sin divisor', () => {
    for (const divisor of [1, 2, 3, 5]) {
      for (let v1 = 0; v1 <= 12; v1 += 1) {
        for (let v2 = 0; v2 <= 12; v2 += 1) {
          for (let v3 = 0; v3 <= 12; v3 += 3) {
            expect(
              calcularPts({ v1, v2, v3, divisor, margenPorCiento: 10 }).stockSugerido,
              `${v1}/${v2}/${v3}÷${divisor}`,
            ).toBe(referencia(v1, v2, v3, divisor, 10));
          }
        }
      }
    }
  });

  it('PR09: rechaza un margen negativo o decimal', () => {
    expect(() => calcularPts({ v1: 1, v2: 1, v3: 1, margenPorCiento: -1 })).toThrow(RangeError);
    expect(() => calcularPts({ v1: 1, v2: 1, v3: 1, margenPorCiento: 7.5 })).toThrow(RangeError);
  });
});
