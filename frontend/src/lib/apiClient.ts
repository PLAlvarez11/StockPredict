const BASE = '/api/v1';

export interface DetalleCampo {
  field: string;
  code: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: DetalleCampo[];
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    errors: DetalleCampo[],
    requestId?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.requestId = requestId;
  }
}

export interface Problema {
  code?: string;
  detail?: string;
  title?: string;
  errors?: DetalleCampo[];
  requestId?: string;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    const init: RequestInit = { method: metodo, credentials: 'same-origin' };
    if (cuerpo !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(cuerpo);
    }
    respuesta = await fetch(`${BASE}${ruta}`, init);
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No hay conexión con el servidor. Intenta de nuevo.',
      [],
    );
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  const datos: unknown = texto ? JSON.parse(texto) : undefined;

  if (!respuesta.ok) {
    const p = (datos ?? {}) as Problema;
    throw new ApiError(
      respuesta.status,
      p.code ?? 'UNKNOWN',
      p.detail ?? p.title ?? 'Ocurrió un error inesperado.',
      p.errors ?? [],
      p.requestId,
    );
  }

  return datos as T;
}
