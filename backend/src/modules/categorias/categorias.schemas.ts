import { z } from 'zod';
import { ICONOS_CATEGORIA } from '../../shared/iconos.js';

const nombre = z
  .string({ error: 'Ingresa el nombre de la categoría.' })
  .trim()
  .min(1, 'Ingresa el nombre de la categoría.')
  .max(100, 'El nombre es demasiado largo.');

const icono = z.enum(ICONOS_CATEGORIA, { error: 'Elige un ícono de la lista.' });

export const crearCategoriaSchema = z.object({ nombre, icono }).strict();

export const editarCategoriaSchema = z
  .object({ nombre: nombre.optional(), icono: icono.optional() })
  .strict()
  .refine((v) => v.nombre !== undefined || v.icono !== undefined, {
    message: 'Indica al menos un campo para editar.',
  });

export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;
export type EditarCategoriaInput = z.infer<typeof editarCategoriaSchema>;
