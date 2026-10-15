import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vigilarBucle } from './vigilancia.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('vigilarBucle', () => {
  it('RNF02: avisa cuando el proceso se detiene más del umbral (suspensión del equipo o bloqueo)', () => {
    const avisos: number[] = [];
    const detener = vigilarBucle({ alDetectar: (r) => avisos.push(r) });
    vi.advanceTimersByTime(3000);
    expect(avisos).toEqual([]);
    vi.setSystemTime(Date.now() + 190_000);
    vi.advanceTimersByTime(1000);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toBeGreaterThanOrEqual(190_000);
    detener();
  });

  it('RNF02: no avisa con retrasos menores al umbral y se puede detener', () => {
    const avisos: number[] = [];
    const detener = vigilarBucle({ umbralMs: 5000, alDetectar: (r) => avisos.push(r) });
    vi.setSystemTime(Date.now() + 1500);
    vi.advanceTimersByTime(1000);
    expect(avisos).toEqual([]);
    detener();
    vi.setSystemTime(Date.now() + 60_000);
    vi.advanceTimersByTime(5000);
    expect(avisos).toEqual([]);
  });
});
