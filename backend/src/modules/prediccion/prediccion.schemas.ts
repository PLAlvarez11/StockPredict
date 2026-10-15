import { z } from 'zod';
import { LIMITE_CANTIDAD } from '../../shared/http/esquemas.js';

export const filtrosPrediccionQuery = z
  .object({
    q: z.string().trim().max(150).optional(),
    categoriaId: z.coerce.number().int().positive().optional(),
    subcategoriaId: z.coerce.number().int().positive().optional(),
    estado: z.enum(['todos', 'rojo', 'ambar', 'verde']).default('todos'),
  })
  .strict();

export const simulacionSchema = z
  .object({
    categoriaId: z
      .number({ error: 'Elige una categoría.' })
      .int('Elige una categoría.')
      .positive('Elige una categoría.'),
    subcategoriaId: z
      .number({ error: 'Elige una subcategoría.' })
      .int('Elige una subcategoría.')
      .positive('Elige una subcategoría.')
      .optional(),
    nombre: z
      .string({ error: 'El nombre debe ser texto.' })
      .trim()
      .max(150, 'El nombre es demasiado largo.')
      .transform((v) => (v.length === 0 ? undefined : v))
      .optional(),
    stockActual: z
      .number({ error: 'El stock debe ser un número.' })
      .int('El stock debe ser un número entero.')
      .min(0, 'El stock no puede ser negativo.')
      .max(LIMITE_CANTIDAD, 'El stock es demasiado grande.')
      .optional(),
  })
  .strict();

export type FiltrosPrediccion = z.infer<typeof filtrosPrediccionQuery>;
export type SimulacionInput = z.infer<typeof simulacionSchema>;
