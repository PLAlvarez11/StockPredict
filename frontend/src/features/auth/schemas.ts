import { z } from 'zod';

const correo = z
  .string()
  .trim()
  .min(1, 'Ingresa tu correo electrónico.')
  .pipe(z.email('Ingresa un correo válido.'));

const contrasenaNueva = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'La contraseña es demasiado larga.');

export const loginSchema = z.object({
  correo,
  contrasena: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const registroSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'Ingresa tu nombre.')
      .max(100, 'El nombre es demasiado largo.'),
    correo,
    contrasena: contrasenaNueva,
    confirmar: z.string().min(1, 'Confirma tu contraseña.'),
  })
  .refine((v) => v.contrasena === v.confirmar, {
    path: ['confirmar'],
    message: 'Las contraseñas no coinciden.',
  });

export const recuperarSchema = z.object({ correo });

export const restablecerSchema = z
  .object({
    contrasena: contrasenaNueva,
    confirmar: z.string().min(1, 'Confirma tu contraseña.'),
  })
  .refine((v) => v.contrasena === v.confirmar, {
    path: ['confirmar'],
    message: 'Las contraseñas no coinciden.',
  });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegistroForm = z.infer<typeof registroSchema>;
export type RecuperarForm = z.infer<typeof recuperarSchema>;
export type RestablecerForm = z.infer<typeof restablecerSchema>;
