import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const COOKIE_SESION = 'sp_session';

const DIA_MS = 86_400_000;

function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function emitirSesion(res: Response, usuarioId: number): void {
  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(usuarioId),
    expiresIn: `${env.SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_SESION, token, { ...opcionesCookie(), maxAge: env.SESSION_DAYS * DIA_MS });
}

export function cerrarSesion(res: Response): void {
  res.clearCookie(COOKIE_SESION, opcionesCookie());
}

export function leerSesion(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const carga = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof carga === 'string' || !carga.sub) return null;
    const id = Number(carga.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
