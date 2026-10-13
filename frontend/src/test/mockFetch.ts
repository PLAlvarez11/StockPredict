import { vi } from 'vitest';

type Respuestas = Record<string, unknown>;

export interface LlamadaSimulada {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
}

export function simularApi(respuestas: Respuestas): LlamadaSimulada[] {
  const llamadas: LlamadaSimulada[] = [];
  const falso = vi.fn((url: string, init?: RequestInit) => {
    const ruta = url.replace('/api/v1', '');
    const metodo = init?.method ?? 'GET';
    llamadas.push({ metodo, ruta, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const clave = Object.keys(respuestas).find((k) => `${metodo} ${ruta}`.startsWith(k));
    const cuerpo = clave ? respuestas[clave] : undefined;
    if (cuerpo === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'NOT_FOUND', detail: 'sin simulación' }), {
          status: 404,
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(cuerpo), {
        status: metodo === 'POST' ? 201 : 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', falso);
  return llamadas;
}
