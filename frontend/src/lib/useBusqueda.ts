import { useState } from 'react';
import { useRetraso } from './useRetraso';

export function useBusqueda() {
  const [texto, setTexto] = useState('');
  const limpio = useRetraso(texto.trim());
  return {
    texto,
    setTexto,
    consulta: limpio === '' ? undefined : limpio,
    limpiar: () => setTexto(''),
    activa: texto.trim() !== '',
  };
}
