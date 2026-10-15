import { z } from 'zod';
import { filtroActivos } from '../../shared/http/estado.js';
import { ICONOS_CATEGORIA } from '../../shared/iconos.js';

const nombre = z
  .string({ error: 'Ingresa el nombre de la subcategoría.' })
  .trim()
  .min(1, 'Ingresa el nombre de la subcategoría.')
  .max(100, 'El nombre es demasiado largo.');

const icono = z.enum(ICONOS_CATEGORIA, { error: 'Elige un ícono de la lista.' });

const categoriaId = z
  .number({ error: 'Elige una categoría.' })
  .int('Elige una categoría.')
  .positive('Elige una categoría.');

export const crearSubcategoriaSchema = z
  .object({ categoriaId, nombre, icono: icono.nullable().optional() })
  .strict();

export const editarSubcategoriaSchema = z
  .object({ nombre: nombre.optional(), icono: icono.nullable().optional() })
  .strict()
  .refine((v) => v.nombre !== undefined || v.icono !== undefined, {
    message: 'Indica al menos un campo para editar.',
  });

export const listarSubcategoriasQuery = z
  .object({
    categoriaId: z.coerce.number().int().positive().optional(),
    estado: filtroActivos,
    q: z.string().trim().max(150).optional(),
  })
  .strict();

export type CrearSubcategoriaInput = z.infer<typeof crearSubcategoriaSchema>;
export type EditarSubcategoriaInput = z.infer<typeof editarSubcategoriaSchema>;
export type ListarSubcategoriasQuery = z.infer<typeof listarSubcategoriasQuery>;
