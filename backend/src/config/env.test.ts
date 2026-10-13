import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esZonaHorariaValida } from './env.js';

describe('esZonaHorariaValida', () => {
  it('acepta zonas IANA reales', () => {
    expect(esZonaHorariaValida('America/Guatemala')).toBe(true);
    expect(esZonaHorariaValida('UTC')).toBe(true);
    expect(esZonaHorariaValida('Asia/Tokyo')).toBe(true);
  });

  it('rechaza zonas inexistentes o vacías', () => {
    expect(esZonaHorariaValida('Mundo/Inexistente')).toBe(false);
    expect(esZonaHorariaValida('Guatemala')).toBe(false);
    expect(esZonaHorariaValida('')).toBe(false);
  });
});

describe('arranque con TIMEZONE', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('usa America/Guatemala si no se define', async () => {
    vi.stubEnv('TIMEZONE', '');
    delete process.env['TIMEZONE'];
    const { env } = await import('./env.js');
    expect(env.TIMEZONE).toBe('America/Guatemala');
  });

  it('no arranca con TIMEZONE inválida y el mensaje dice cuál es el problema', async () => {
    vi.stubEnv('TIMEZONE', 'Mundo/Inexistente');
    await expect(import('./env.js')).rejects.toThrow(
      /TIMEZONE: "Mundo\/Inexistente" no es una zona horaria IANA válida/,
    );
  });
});
