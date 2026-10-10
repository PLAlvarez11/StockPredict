import { describe, expect, it } from 'vitest';
import { nivelStock } from './stock.js';

describe('nivelStock con umbral 3', () => {
  it.each([
    [0, 'agotado'],
    [1, 'bajo'],
    [3, 'bajo'],
    [4, 'ok'],
    [25, 'ok'],
  ] as const)('stock %i es %s', (stock, esperado) => {
    expect(nivelStock(stock, 3)).toBe(esperado);
  });
});
