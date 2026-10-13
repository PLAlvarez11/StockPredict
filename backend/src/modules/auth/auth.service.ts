import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { correoRecuperacion, type Mailer } from '../../mail/mailer.js';
import { AppError, noAutenticado } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger.js';
import { authRepository } from './auth.repository.js';
import type {
  LoginInput,
  RecuperarInput,
  RegistroInput,
  RestablecerInput,
} from './auth.schemas.js';
import type { PasswordHasher } from './password-hasher.js';

export interface UsuarioPublico {
  id: number;
  nombre: string;
  correo: string;
}

interface Dependencias {
  hasher: PasswordHasher;
  mailer: Mailer;
}

const sha256 = (valor: string) => createHash('sha256').update(valor).digest('hex');

const aPublico = (u: { id: number; nombre: string; correo: string }): UsuarioPublico => ({
  id: u.id,
  nombre: u.nombre,
  correo: u.correo,
});

export function crearAuthService({ hasher, mailer }: Dependencias) {
  const hashFicticio = hasher.hash('contrasena-ficticia-para-igualar-tiempos');

  const enCurso = new Set<Promise<void>>();

  const procesarRecuperacion = async (datos: RecuperarInput): Promise<void> => {
    const usuario = await authRepository.buscarPorCorreo(datos.correo);
    if (!usuario) return;

    await authRepository.invalidarTokens(usuario.id);
    const token = randomBytes(32).toString('base64url');
    await authRepository.crearToken({
      usuarioId: usuario.id,
      tokenHash: sha256(token),
      expiraEn: new Date(Date.now() + env.RESET_TOKEN_MINUTES * 60_000),
    });

    const enlace = `${env.APP_BASE_URL}/restablecer?token=${token}`;
    await mailer.enviar(
      correoRecuperacion(usuario.correo, usuario.nombre, enlace, env.RESET_TOKEN_MINUTES),
    );
  };

  return {
    async registrar(datos: RegistroInput): Promise<UsuarioPublico> {
      const existente = await authRepository.buscarPorCorreo(datos.correo);
      if (existente) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Correo ya registrado', {
          detail: 'Ya existe una cuenta con ese correo.',
          errors: [
            {
              field: 'correo',
              code: 'EMAIL_TAKEN',
              message: 'Ya existe una cuenta con ese correo.',
            },
          ],
        });
      }
      const usuario = await authRepository.crearUsuario({
        nombre: datos.nombre,
        correo: datos.correo,
        contrasenaHash: await hasher.hash(datos.contrasena),
      });
      return aPublico(usuario);
    },

    async iniciarSesion(datos: LoginInput): Promise<UsuarioPublico> {
      const usuario = await authRepository.buscarPorCorreo(datos.correo);
      const hash = usuario ? usuario.contrasenaHash : await hashFicticio;
      const valida = await hasher.verify(datos.contrasena, hash);
      if (!usuario || !valida) {
        throw noAutenticado('Correo o contraseña incorrectos.');
      }
      return aPublico(usuario);
    },

    async obtenerPerfil(usuarioId: number): Promise<UsuarioPublico> {
      const usuario = await authRepository.buscarPorId(usuarioId);
      if (!usuario) throw noAutenticado();
      return aPublico(usuario);
    },

    recuperar(datos: RecuperarInput): Promise<void> {
      const tarea: Promise<void> = procesarRecuperacion(datos)
        .catch((err: unknown) =>
          logger.error({ err }, 'no se pudo procesar la recuperación de contraseña'),
        )
        .finally(() => enCurso.delete(tarea));
      enCurso.add(tarea);
      return Promise.resolve();
    },

    async esperarTareas(): Promise<void> {
      await Promise.all([...enCurso]);
    },

    async restablecer(datos: RestablecerInput): Promise<void> {
      const invalido = () =>
        new AppError(410, 'TOKEN_INVALID', 'Enlace inválido o vencido', {
          detail: 'El enlace no es válido o ya venció. Solicita uno nuevo.',
        });

      const registro = await authRepository.buscarToken(sha256(datos.token));
      if (!registro || registro.usadoEn || registro.expiraEn.getTime() <= Date.now()) {
        throw invalido();
      }
      const contrasenaHash = await hasher.hash(datos.contrasena);
      const consumido = await authRepository.consumirToken(
        registro.id,
        registro.usuarioId,
        contrasenaHash,
      );
      if (!consumido) throw invalido();
    },
  };
}

export type AuthService = ReturnType<typeof crearAuthService>;
