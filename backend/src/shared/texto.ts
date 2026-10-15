export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function coincideBusqueda(busqueda: string | undefined, ...textos: string[]): boolean {
  const q = busqueda === undefined ? '' : normalizarTexto(busqueda);
  if (q === '') return true;
  return textos.some((t) => normalizarTexto(t).includes(q));
}
