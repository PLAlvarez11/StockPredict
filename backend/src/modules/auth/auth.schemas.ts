import { z } from 'zod';

const correo = z
  .string({ error: 'Ingresa tu correo electrónico.' })
  .trim()
  .toLowerCase()
  .max(150, 'El correo es demasiado largo.')
  .pipe(z.email('Ingresa un correo válido.'));

const contrasenaNueva = z
  .string({ error: 'Ingresa una contraseña.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'La contraseña es demasiado larga.');

export const registroSchema = z
  .object({
    nombre: z
      .string({ error: 'Ingresa tu nombre.' })
      .trim()
      .min(1, 'Ingresa tu nombre.')
      .max(100, 'El nombre es demasiado largo.'),
    correo,
    contrasena: contrasenaNueva,
  })
  .strict();

export const loginSchema = z
  .object({
    correo,
    contrasena: z
      .string({ error: 'Ingresa tu contraseña.' })
      .min(1, 'Ingresa tu contraseña.')
      .max(200),
  })
  .strict();

export const recuperarSchema = z.object({ correo }).strict();

export const restablecerSchema = z
  .object({
    token: z.string({ error: 'Enlace inválido.' }).min(20).max(200),
    contrasena: contrasenaNueva,
  })
  .strict();

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecuperarInput = z.infer<typeof recuperarSchema>;
export type RestablecerInput = z.infer<typeof restablecerSchema>;
