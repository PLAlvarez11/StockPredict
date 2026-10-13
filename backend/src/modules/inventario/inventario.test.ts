import request from 'supertest';
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

const ajustar = (datos: object) => agente.post('/api/v1/inventario/ajustes').send(datos);
const stockDe = async (id: number) =>
  (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock;

describe('ajustar stock manual', () => {
  it('A01 y A02: reemplaza el stock por el nuevo valor y guarda el movimiento con el stock anterior', async () => {
    const res = await ajustar({ productoId: producto.id, cantidad: 2 });
    expect(res.status).toBe(201);
    expect(res.body.stockActual).toBe(2);
    expect(await stockDe(producto.id)).toBe(2);
    const mov = await prisma.movimientoInventario.findFirstOrThrow({
      where: { productoId: producto.id },
    });
    expect(mov).toMatchObject({ tipo: 'ajuste', cantidad: 2, stockAnterior: 5 });
    expect(res.body.movimiento).toMatchObject({ tipo: 'ajuste', cantidad: 2, stockAnterior: 5 });
  });

  it('A01: acepta subir el stock y dejarlo en cero', async () => {
    expect((await ajustar({ productoId: producto.id, cantidad: 40 })).body.stockActual).toBe(40);
    expect((await ajustar({ productoId: producto.id, cantidad: 0 })).body.stockActual).toBe(0);
    expect(await stockDe(producto.id)).toBe(0);
    expect(await prisma.movimientoInventario.count()).toBe(2);
  });

  it('A03: rechaza un valor negativo, decimal, textual o demasiado grande sin tocar el stock', async () => {
    for (const cantidad of [-1, 1.5, '3', null, 1_000_001]) {
      const res = await ajustar({ productoId: producto.id, cantidad });
      expect(res.status, String(cantidad)).toBe(422);
      expect(res.body.errors[0].field).toBe('cantidad');
    }
    expect(await stockDe(producto.id)).toBe(5);
    expect(await prisma.movimientoInventario.count()).toBe(0);
  });

  it('A04: rechaza un ajuste sin producto o con un producto inválido', async () => {
    const sin = await ajustar({ cantidad: 3 });
    expect(sin.status).toBe(422);
    expect(sin.body.errors[0].field).toBe('productoId');
    expect((await ajustar({ productoId: 0, cantidad: 3 })).status).toBe(422);
    expect((await ajustar({ productoId: 'abc', cantidad: 3 })).status).toBe(422);
  });

  it('un producto de otro usuario responde 404 y no cambia', async () => {
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const res = await otra
      .post('/api/v1/inventario/ajustes')
      .send({ productoId: producto.id, cantidad: 99 });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(await stockDe(producto.id)).toBe(5);
    expect(await prisma.movimientoInventario.count()).toBe(0);
  });

  it('un producto inexistente responde 404 igual que uno ajeno', async () => {
    const res = await ajustar({ productoId: 99999, cantidad: 1 });
    expect(res.status).toBe(404);
  });

  it('sin sesión responde 401', async () => {
    const res = await request(app)
      .post('/api/v1/inventario/ajustes')
      .send({ productoId: producto.id, cantidad: 1 });
    expect(res.status).toBe(401);
    expect(await stockDe(producto.id)).toBe(5);
  });

  it('un producto inactivo responde 422', async () => {
    await agente.delete(`/api/v1/productos/${producto.id}`);
    const res = await ajustar({ productoId: producto.id, cantidad: 1 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INACTIVE_RESOURCE');
  });

  it('mass assignment: rechaza stockAnterior, tipo, fecha, usuarioId y campos desconocidos', async () => {
    for (const extra of [
      { stockAnterior: 100 },
      { tipo: 'compra' },
      { fecha: '2020-01-01' },
      { usuarioId: 1 },
      { zzz: 1 },
    ]) {
      const res = await ajustar({ productoId: producto.id, cantidad: 3, ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(422);
    }
    expect(await stockDe(producto.id)).toBe(5);
  });

  it('ajustes simultáneos encadenan el stock anterior sin perder ninguno', async () => {
    const [a, b] = await Promise.all([
      ajustar({ productoId: producto.id, cantidad: 10 }),
      ajustar({ productoId: producto.id, cantidad: 20 }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { productoId: producto.id },
      orderBy: { id: 'asc' },
    });
    expect(movimientos).toHaveLength(2);
    const [primero, segundo] = movimientos;
    expect(primero?.stockAnterior).toBe(5);
    expect(segundo?.stockAnterior).toBe(primero?.cantidad);
    expect(await stockDe(producto.id)).toBe(segundo?.cantidad);
  });
});
