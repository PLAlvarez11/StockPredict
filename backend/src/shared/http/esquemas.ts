import { z } from 'zod';

export const idParams = z.object({
  id: z.coerce
    .number({ error: 'Identificador inválido.' })
    .int('Identificador inválido.')
    .positive('Identificador inválido.')
    .max(2_147_483_647, 'Identificador inválido.'),
});

export const LIMITE_CANTIDAD = 1_000_000;
