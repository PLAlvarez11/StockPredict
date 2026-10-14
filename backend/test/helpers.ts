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
    'TRUNCATE TABLE usuario, categoria, subcategoria, producto, venta, movimiento_inventario, token_recuperacion RESTART IDENTITY CASCADE',
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

type Agente = Awaited<ReturnType<typeof iniciarSesionDePrueba>>;

export interface Catalogo {
  categoria: { id: number; nombre: string; icono: string };
  subcategoria: { id: number; nombre: string; icono: string; iconoPropio: string | null };
}

export async function crearCatalogoDePrueba(
  agente: Agente,
  categoria = 'Ropa',
  subcategoria = 'Blusas',
  icono = 't-shirt',
): Promise<Catalogo> {
  const cat = await agente.post('/api/v1/categorias').send({ nombre: categoria, icono });
  if (cat.status !== 201) throw new Error(`No se pudo crear la categoría: ${cat.status}`);
  const sub = await agente
    .post('/api/v1/subcategorias')
    .send({ categoriaId: cat.body.id, nombre: subcategoria });
  if (sub.status !== 201) throw new Error(`No se pudo crear la subcategoría: ${sub.status}`);
  return { categoria: cat.body, subcategoria: sub.body };
}
