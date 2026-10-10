import { Router, type Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { requiereSesion } from '../../shared/http/requiere-sesion.js';
import { validar } from '../../shared/http/validate.js';
import {
  loginSchema,
  recuperarSchema,
  registroSchema,
  restablecerSchema,
  type LoginInput,
  type RecuperarInput,
  type RegistroInput,
  type RestablecerInput,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import { cerrarSesion, emitirSesion } from './session.js';

export interface LimitesAuth {
  loginMax: number;
  loginVentanaMin: number;
  recuperarMax: number;
  recuperarVentanaMin: number;
}

export const limitesPorDefecto = (): LimitesAuth => ({
  loginMax: env.RATE_LIMIT_LOGIN_MAX,
  loginVentanaMin: env.RATE_LIMIT_LOGIN_WINDOW_MIN,
  recuperarMax: env.RATE_LIMIT_RECOVER_MAX,
  recuperarVentanaMin: env.RATE_LIMIT_RECOVER_WINDOW_MIN,
});

function limitador(max: number, ventanaMin: number, conCorreo: boolean, soloFallidos: boolean) {
  return rateLimit({
    windowMs: ventanaMin * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: soloFallidos,
    keyGenerator: (req: Request) => {
      const ip = ipKeyGenerator(req.ip ?? '');
      const correo =
        conCorreo && typeof req.body?.correo === 'string' ? req.body.correo.toLowerCase() : '';
      return `${ip}|${correo}`;
    },
    handler: (_req, res, next) => {
      const reintentar = res.getHeader('Retry-After') ?? ventanaMin * 60;
      next(
        new AppError(429, 'RATE_LIMITED', 'Demasiados intentos', {
          detail: 'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
          headers: { 'Retry-After': String(reintentar) },
        }),
      );
    },
  });
}

export function crearAuthRouter(
  servicio: AuthService,
  limites: LimitesAuth = limitesPorDefecto(),
): Router {
  const router = Router();
  const limiteLogin = limitador(limites.loginMax, limites.loginVentanaMin, true, true);
  const limiteRecuperar = limitador(
    limites.recuperarMax,
    limites.recuperarVentanaMin,
    false,
    false,
  );

  router.post('/registro', validar({ body: registroSchema }), async (req, res) => {
    const usuario = await servicio.registrar(req.body as RegistroInput);
    emitirSesion(res, usuario.id);
    res.status(201).json({ usuario });
  });

  router.post('/login', validar({ body: loginSchema }), limiteLogin, async (req, res) => {
    const usuario = await servicio.iniciarSesion(req.body as LoginInput);
    emitirSesion(res, usuario.id);
    res.json({ usuario });
  });

  router.post('/logout', (_req, res) => {
    cerrarSesion(res);
    res.status(204).end();
  });

  router.get('/me', requiereSesion, async (req, res) => {
    const usuario = await servicio.obtenerPerfil(req.usuarioId as number);
    res.json(usuario);
  });

  router.post(
    '/recuperar',
    validar({ body: recuperarSchema }),
    limiteRecuperar,
    async (req, res) => {
      await servicio.recuperar(req.body as RecuperarInput);
      res.status(202).json({
        mensaje: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.',
      });
    },
  );

  router.post('/restablecer', validar({ body: restablecerSchema }), async (req, res) => {
    await servicio.restablecer(req.body as RestablecerInput);
    res.status(204).end();
  });

  return router;
}
