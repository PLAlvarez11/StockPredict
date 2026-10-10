import { describe, expect, it } from 'vitest';
import { inicioSemana, semanaDe, semanasCerradas } from './semana.js';

const ZONA = 'America/Guatemala';

describe('semana', () => {
  it('el domingo 23:59 hora Guatemala pertenece a la semana que empezó el lunes anterior', () => {
    const instante = new Date('2026-10-12T05:59:00Z');
    expect(inicioSemana(instante, ZONA).toISOString()).toBe('2026-10-05T06:00:00.000Z');
  });

  it('el lunes 00:00 hora Guatemala abre una semana nueva', () => {
    const instante = new Date('2026-10-12T06:00:00Z');
    expect(inicioSemana(instante, ZONA).toISOString()).toBe('2026-10-12T06:00:00.000Z');
  });

  it('semanaDe cubre exactamente 7 días', () => {
    const { inicio, fin } = semanaDe(new Date('2026-10-09T15:00:00Z'), ZONA);
    expect(fin.getTime() - inicio.getTime()).toBe(7 * 86_400_000);
  });

  it('semanasCerradas devuelve V1 como la más reciente y excluye la semana en curso', () => {
    const semanas = semanasCerradas(new Date('2026-10-09T15:00:00Z'), ZONA, 3);
    expect(semanas.map((s) => s.inicio.toISOString())).toEqual([
      '2026-09-28T06:00:00.000Z',
      '2026-09-21T06:00:00.000Z',
      '2026-09-14T06:00:00.000Z',
    ]);
    expect(semanas[0]?.fin.toISOString()).toBe('2026-10-05T06:00:00.000Z');
  });

  it('cruza el cambio de año', () => {
    const semanas = semanasCerradas(new Date('2027-01-05T12:00:00Z'), ZONA, 1);
    expect(semanas[0]?.inicio.toISOString()).toBe('2026-12-28T06:00:00.000Z');
  });
});
