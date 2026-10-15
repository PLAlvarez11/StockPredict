export interface OpcionesVigilancia {
  intervaloMs?: number;
  umbralMs?: number;
  alDetectar: (retrasoMs: number) => void;
}

export function vigilarBucle({
  intervaloMs = 1000,
  umbralMs = 2000,
  alDetectar,
}: OpcionesVigilancia): () => void {
  let esperado = Date.now() + intervaloMs;
  const temporizador = setInterval(() => {
    const ahora = Date.now();
    const retraso = ahora - esperado;
    esperado = ahora + intervaloMs;
    if (retraso >= umbralMs) alDetectar(retraso);
  }, intervaloMs);
  temporizador.unref();
  return () => clearInterval(temporizador);
}
