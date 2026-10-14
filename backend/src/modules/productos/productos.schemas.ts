import { z } from 'zod';
import { filtroActivos } from '../../shared/http/estado.js';
import { LIMITE_CANTIDAD } from '../../shared/http/esquemas.js';

const nombre = z
  .string({ error: 'Ingresa el nombre del producto.' })
  .trim()
  .min(1, 'Ingresa el nombre del producto.')
  .max(150, 'El nombre es demasiado largo.');

const subcategoriaId = z
  .number({ error: 'Elige una subcategoría.' })
  .int('Elige una subcategoría.')
  .positive('Elige una subcategoría.');

const descripcion = z
  .string({ error: 'La descripción debe ser texto.' })
  .trim()
  .max(500, 'La descripción no puede pasar de 500 caracteres.')
  .transform((v) => (v.length === 0 ? null : v));

export const crearProductoSchema = z
  .object({
    nombre,
    subcategoriaId,
    descripcion: descripcion.nullable().optional(),
    estado: z.boolean({ error: 'El estado debe ser verdadero o falso.' }).optional(),
    stockInicial: z
      .number({ error: 'Ingresa el stock inicial.' })
      .int('El stock debe ser un número entero.')
      .min(0, 'El stock no puede ser negativo.')
      .max(LIMITE_CANTIDAD, 'El stock es demasiado grande.'),
  })
  .strict();

export const editarProductoSchema = z
  .object({
    nombre: nombre.optional(),
    subcategoriaId: subcategoriaId.optional(),
    descripcion: descripcion.nullable().optional(),
  })
  .strict()
  .refine(
    (v) => v.nombre !== undefined || v.subcategoriaId !== undefined || v.descripcion !== undefined,
    { message: 'Indica al menos un campo para editar.' },
  );

export const listarProductosQuery = z
  .object({
    categoriaId: z.coerce.number().int().positive().optional(),
    subcategoriaId: z.coerce.number().int().positive().optional(),
    estado: filtroActivos,
    q: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type EditarProductoInput = z.infer<typeof editarProductoSchema>;
export type ListarProductosQuery = z.infer<typeof listarProductosQuery>;
