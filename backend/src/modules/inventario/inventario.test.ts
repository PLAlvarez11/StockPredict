import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { crearMailerFalso, iniciarSesionDePrueba, limpiarBase } from '../../../test/helpers.js';

const app = crearApp({ mailer: crearMailerFalso() });
let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let producto: { id: number };

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  const categoria = (
    await agente.post('/api/v1/categorias').send({ nombre: 'Ropa', icono: 't-shirt' })
  ).body;
  producto = (
    await agente
      .post('/api/v1/productos')
      .send({ nombre: 'Blusa', categoriaId: categoria.id, stockInicial: 5 })
  ).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const comprar = (datos: object) => agente.post('/api/v1/inventario/compras').send(datos);

describe('registrar compra', () => {
  it('CO01 y CO02: suma al stock y guarda el movimiento con el stock anterior', async () => {
    const res = await comprar({ productoId: producto.id, cantidad: 7 });
    expect(res.status).toBe(201);
    expect(res.body.stockActual).toBe(12);
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } });
    expect(fila.stock).toBe(12);
    const mov = await prisma.movimientoInventario.findFirstOrThrow({
      where: { productoId: producto.id },
    });
    expect(mov).toMatchObject({ tipo: 'compra', cantidad: 7, stockAnterior: 5 });
  });

  it('CO03: rechaza cantidad cero, negativa o decimal', async () => {
    for (const cantidad of [0, -3, 2.5]) {
      expect((await comprar({ productoId: producto.id, cantidad })).status).toBe(422);
    }
    expect(await prisma.movimientoInventario.count()).toBe(0);
  });

  it('CO04: rechaza una compra sin producto', async () => {
    const res = await comprar({ cantidad: 3 });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('productoId');
  });

  it('rechaza productos inexistentes, ajenos o inactivos', async () => {
    expect((await comprar({ productoId: 99999, cantidad: 1 })).status).toBe(404);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajeno = await otra
      .post('/api/v1/inventario/compras')
      .send({ productoId: producto.id, cantidad: 1 });
    expect(ajeno.status).toBe(404);
    await agente.delete(`/api/v1/productos/${producto.id}`);
    expect((await comprar({ productoId: producto.id, cantidad: 1 })).status).toBe(422);
  });
});
