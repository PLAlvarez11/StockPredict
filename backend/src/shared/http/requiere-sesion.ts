import type { RequestHandler } from 'express';
import { COOKIE_SESION, leerSesion } from '../../modules/auth/session.js';
import { noAutenticado } from '../errors/app-error.js';

export const requiereSesion: RequestHandler = (req, _res, next) => {
  const usuarioId = leerSesion(req.cookies?.[COOKIE_SESION]);
  if (usuarioId === null) {
    next(noAutenticado());
    return;
  }
  req.usuarioId = usuarioId;
  next();
};
