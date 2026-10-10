import { z } from 'zod';
import { LIMITE_CANTIDAD } from '../../shared/http/esquemas.js';

export const crearVentaSchema = z
  .object({
    productoId: z
      .number({ error: 'Elige un producto.' })
      .int('Elige un producto.')
      .positive('Elige un producto.'),
    cantidad: z
      .number({ error: 'Ingresa la cantidad vendida.' })
      .int('La cantidad debe ser un número entero.')
      .min(1, 'La cantidad debe ser mayor a cero.')
      .max(LIMITE_CANTIDAD, 'La cantidad es demasiado grande.'),
  })
  .strict();

export type CrearVentaInput = z.infer<typeof crearVentaSchema>;
