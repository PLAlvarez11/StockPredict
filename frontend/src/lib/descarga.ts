import { ApiError, type Problema } from './apiClient';

const BASE = '/api/v1';

export interface ArchivoDescargado {
  blob: Blob;
  nombre: string;
}

function leerProblema(texto: string): Problema {
  try {
    return texto ? (JSON.parse(texto) as Problema) : {};
  } catch {
    return {};
  }
}

export async function descargarArchivo(ruta: string): Promise<ArchivoDescargado> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, { method: 'GET', credentials: 'same-origin' });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No hay conexión con el servidor. Intenta de nuevo.',
      [],
    );
  }
  if (!respuesta.ok) {
    const p = leerProblema(await respuesta.text());
    throw new ApiError(
      respuesta.status,
      p.code ?? 'UNKNOWN',
      p.detail ?? p.title ?? 'Ocurrió un error inesperado.',
      p.errors ?? [],
      p.requestId,
    );
  }
  const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
  const nombre = /filename="([^"]+)"/.exec(disposicion)?.[1] ?? 'stockpredict-prediccion';
  return { blob: await respuesta.blob(), nombre };
}
