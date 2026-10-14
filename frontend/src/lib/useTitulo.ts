import { useEffect } from 'react';

export function useTitulo(titulo: string): void {
  useEffect(() => {
    document.title = `${titulo} · StockPredict`;
  }, [titulo]);
}
