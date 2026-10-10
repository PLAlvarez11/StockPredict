import type { Express } from 'express';
import request from 'supertest';
import type { Correo, Mailer } from '../src/mail/mailer.js';
import { prisma } from '../src/shared/db/prisma.js';

export function crearMailerFalso(): Mailer & { enviados: Correo[] } {
  const enviados: Correo[] = [];
  return {
    enviados,
    async enviar(correo) {
      enviados.push(correo);
    },
  };
}

export async function limpiarBase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE usuario, categoria, producto, venta, movimiento_inventario, token_recuperacion RESTART IDENTITY CASCADE',
  );
}

export async function iniciarSesionDePrueba(app: Express, correo = 'prueba@ejemplo.com') {
  const agente = request.agent(app);
  const res = await agente
    .post('/api/v1/auth/registro')
    .send({ nombre: 'Prueba', correo, contrasena: 'ClaveSegura1' });
  if (res.status !== 201) throw new Error(`No se pudo registrar: ${res.status}`);
  return agente;
}
