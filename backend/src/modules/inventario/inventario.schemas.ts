import { z } from 'zod';
import { LIMITE_CANTIDAD } from '../../shared/http/esquemas.js';

export const crearCompraSchema = z
  .object({
    productoId: z
      .number({ error: 'Elige un producto.' })
      .int('Elige un producto.')
      .positive('Elige un producto.'),
    cantidad: z
      .number({ error: 'Ingresa la cantidad comprada.' })
      .int('La cantidad debe ser un número entero.')
      .min(1, 'La cantidad debe ser mayor a cero.')
      .max(LIMITE_CANTIDAD, 'La cantidad es demasiado grande.'),
  })
  .strict();

export type CrearCompraInput = z.infer<typeof crearCompraSchema>;

export const crearAjusteSchema = z
  .object({
    productoId: z
      .number({ error: 'Elige un producto.' })
      .int('Elige un producto.')
      .positive('Elige un producto.'),
    cantidad: z
      .number({ error: 'Ingresa el nuevo stock.' })
      .int('El stock debe ser un número entero.')
      .min(0, 'El stock no puede ser negativo.')
      .max(LIMITE_CANTIDAD, 'El stock es demasiado grande.'),
  })
  .strict();

export type CrearAjusteInput = z.infer<typeof crearAjusteSchema>;
