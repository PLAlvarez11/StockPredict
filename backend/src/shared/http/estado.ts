import { z } from 'zod';

export const filtroActivos = z.enum(['activos', 'inactivos', 'todos']).default('activos');

export type FiltroActivos = z.infer<typeof filtroActivos>;

export function condicionEstado(filtro: FiltroActivos): { estado?: boolean } {
  if (filtro === 'activos') return { estado: true };
  if (filtro === 'inactivos') return { estado: false };
  return {};
}
