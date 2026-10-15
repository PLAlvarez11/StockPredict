const ZONA = 'America/Guatemala';

const numero = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 2 });

export const formatearNumero = (valor: number): string => numero.format(valor);

const dia = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: ZONA });

export function formatearSemana(semana: { inicio: string; fin: string }): string {
  const desde = new Date(semana.inicio);
  const hasta = new Date(new Date(semana.fin).getTime() - 1);
  return `del ${dia.format(desde)} al ${dia.format(hasta)}`;
}

export function formatearRangoSemanas(semanas: { inicio: string; fin: string }[]): string | null {
  const primera = semanas[semanas.length - 1];
  const ultima = semanas[0];
  if (!primera || !ultima) return null;
  const desde = new Date(primera.inicio);
  const hasta = new Date(new Date(ultima.fin).getTime() - 1);
  return `${dia.format(desde)} – ${dia.format(hasta)}`;
}
