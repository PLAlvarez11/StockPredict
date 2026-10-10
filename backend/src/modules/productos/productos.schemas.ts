import { z } from 'zod';
import { LIMITE_CANTIDAD } from '../../shared/http/esquemas.js';

const nombre = z
  .string({ error: 'Ingresa el nombre del producto.' })
  .trim()
  .min(1, 'Ingresa el nombre del producto.')
  .max(150, 'El nombre es demasiado largo.');

const categoriaId = z
  .number({ error: 'Elige una categoría.' })
  .int('Elige una categoría.')
  .positive('Elige una categoría.');

export const crearProductoSchema = z
  .object({
    nombre,
    categoriaId,
    stockInicial: z
      .number({ error: 'Ingresa el stock inicial.' })
      .int('El stock debe ser un número entero.')
      .min(0, 'El stock no puede ser negativo.')
      .max(LIMITE_CANTIDAD, 'El stock es demasiado grande.'),
  })
  .strict();

export const editarProductoSchema = z
  .object({ nombre: nombre.optional(), categoriaId: categoriaId.optional() })
  .strict()
  .refine((v) => v.nombre !== undefined || v.categoriaId !== undefined, {
    message: 'Indica al menos un campo para editar.',
  });

export const listarProductosQuery = z.object({
  categoriaId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type EditarProductoInput = z.infer<typeof editarProductoSchema>;
export type ListarProductosQuery = z.infer<typeof listarProductosQuery>;
