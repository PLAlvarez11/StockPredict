const DIA_MS = 86_400_000;

export interface Semana {
  inicio: Date;
  fin: Date;
}

const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

interface Partes {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
  diaSemana: number;
}

function partes(instante: Date, zona: string): Partes {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  });
  const mapa: Record<string, string> = {};
  for (const p of formato.formatToParts(instante)) mapa[p.type] = p.value;
  return {
    anio: Number(mapa['year']),
    mes: Number(mapa['month']),
    dia: Number(mapa['day']),
    hora: Number(mapa['hour']),
    minuto: Number(mapa['minute']),
    segundo: Number(mapa['second']),
    diaSemana: DIAS[mapa['weekday'] ?? ''] ?? 1,
  };
}

function desfase(instante: Date, zona: string): number {
  const p = partes(instante, zona);
  const local = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return local - Math.floor(instante.getTime() / 1000) * 1000;
}

function instanteLocal(anio: number, mes: number, dia: number, zona: string): Date {
  const aproximado = new Date(Date.UTC(anio, mes - 1, dia));
  const primero = new Date(aproximado.getTime() - desfase(aproximado, zona));
  return new Date(aproximado.getTime() - desfase(primero, zona));
}

export function inicioSemana(instante: Date, zona: string): Date {
  const p = partes(instante, zona);
  const lunes = new Date(Date.UTC(p.anio, p.mes - 1, p.dia) - (p.diaSemana - 1) * DIA_MS);
  return instanteLocal(lunes.getUTCFullYear(), lunes.getUTCMonth() + 1, lunes.getUTCDate(), zona);
}

export function semanaDe(instante: Date, zona: string): Semana {
  const inicio = inicioSemana(instante, zona);
  const siguiente = new Date(inicio.getTime() + 7 * DIA_MS + 12 * 3_600_000);
  return { inicio, fin: inicioSemana(siguiente, zona) };
}

export function semanasCerradas(referencia: Date, zona: string, cantidad = 3): Semana[] {
  const resultado: Semana[] = [];
  let cursor = inicioSemana(referencia, zona);
  for (let i = 0; i < cantidad; i += 1) {
    const anterior = inicioSemana(new Date(cursor.getTime() - 12 * 3_600_000), zona);
    resultado.push({ inicio: anterior, fin: cursor });
    cursor = anterior;
  }
  return resultado;
}
