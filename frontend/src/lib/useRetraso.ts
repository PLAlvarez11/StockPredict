import { useEffect, useState } from 'react';

export function useRetraso<T>(valor: T, milisegundos = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setRetrasado(valor), milisegundos);
    return () => clearTimeout(id);
  }, [valor, milisegundos]);
  return retrasado;
}
