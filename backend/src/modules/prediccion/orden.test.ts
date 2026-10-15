import { describe, expect, it } from 'vitest';
import {
  compararPredicciones,
  necesidadPorcentual,
  normalizarTexto,
  semaforoDe,
  type Ordenable,
} from './orden.js';

const item = (
  nombre: string,
  estado: Ordenable['estado'],
  necesidadPct: number | null,
  cantidadAComprar: number | null,
): Ordenable => ({ nombre, estado, necesidadPct, cantidadAComprar });

const ordenar = (items: Ordenable[]) => [...items].sort(compararPredicciones).map((i) => i.nombre);

describe('necesidadPorcentual', () => {
  it('PR13: stock 92 con sugerido 100 da 8 %, y stock 4 con sugerido 9 da 56 %', () => {
    expect(necesidadPorcentual(8, 100)).toBe(8);
    expect(necesidadPorcentual(5, 9)).toBe(56);
  });

  it('PR13: sin compra es 0 %, y comprar todo el sugerido es 100 %', () => {
    expect(necesidadPorcentual(0, 10)).toBe(0);
    expect(necesidadPorcentual(10, 10)).toBe(100);
    expect(necesidadPorcentual(0, 0)).toBe(0);
  });

  it('PR13: redondea a medio hacia arriba con enteros y nunca muestra 0 % si hay que comprar', () => {
    expect(necesidadPorcentual(1, 8)).toBe(13);
    expect(necesidadPorcentual(1, 3)).toBe(33);
    expect(necesidadPorcentual(1, 1000)).toBe(1);
  });

  it('PR13: rechaza decimales', () => {
    expect(() => necesidadPorcentual(1.5, 10)).toThrow(RangeError);
  });
});

describe('semaforoDe', () => {
  it('PR18: rojo desde 50 % de necesidad, ámbar por debajo, verde si no hay que comprar y neutro sin historial', () => {
    expect(semaforoDe('comprar', 50)).toBe('rojo');
    expect(semaforoDe('comprar', 100)).toBe('rojo');
    expect(semaforoDe('comprar', 49)).toBe('ambar');
    expect(semaforoDe('comprar', 1)).toBe('ambar');
    expect(semaforoDe('suficiente', 0)).toBe('verde');
    expect(semaforoDe('sin_historial', null)).toBe('neutro');
  });

  it('PR18: el límite sigue al porcentaje redondeado (5 de 10 = 50 % rojo; 4 de 9 = 44 % ámbar)', () => {
    expect(semaforoDe('comprar', necesidadPorcentual(5, 10))).toBe('rojo');
    expect(semaforoDe('comprar', necesidadPorcentual(4, 9))).toBe('ambar');
    expect(semaforoDe('comprar', necesidadPorcentual(5, 9))).toBe('rojo');
  });
});

describe('compararPredicciones', () => {
  it('PR08: 5 de 9 (56 %) va antes que 8 de 100 (8 %) aunque compre menos unidades', () => {
    const lista = [item('Cien', 'comprar', 8, 8), item('Nueve', 'comprar', 56, 5)];
    expect(ordenar(lista)).toEqual(['Nueve', 'Cien']);
  });

  it('PR08: con el mismo porcentaje va primero el que compra más unidades', () => {
    const lista = [item('Poco', 'comprar', 50, 2), item('Mucho', 'comprar', 50, 10)];
    expect(ordenar(lista)).toEqual(['Mucho', 'Poco']);
  });

  it('PR08: con todo igual desempata por nombre', () => {
    const lista = [item('Zapato', 'comprar', 50, 4), item('Árbol', 'comprar', 50, 4)];
    expect(ordenar(lista)).toEqual(['Árbol', 'Zapato']);
  });

  it('PR08: después de los que compran van los suficientes y al final los sin historial', () => {
    const lista = [
      item('Sin datos', 'sin_historial', null, null),
      item('Suficiente B', 'suficiente', 0, 0),
      item('Compra', 'comprar', 1, 1),
      item('Suficiente A', 'suficiente', 0, 0),
    ];
    expect(ordenar(lista)).toEqual(['Compra', 'Suficiente A', 'Suficiente B', 'Sin datos']);
  });
});

describe('normalizarTexto', () => {
  it('PR14: ignora mayúsculas y acentos', () => {
    expect(normalizarTexto('  Camisón ÁRBOL ')).toBe('camison arbol');
  });
});
