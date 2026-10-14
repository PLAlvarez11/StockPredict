import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import {
  crearCatalogoDePrueba,
  crearMailerFalso,
  iniciarSesionDePrueba,
  limpiarBase,
} from '../../../test/helpers.js';

const app = crearApp({ mailer: crearMailerFalso() });
let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let producto: { id: number };

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  const { subcategoria } = await crearCatalogoDePrueba(agente);
  producto = (
    await agente
      .post('/api/v1/productos')
      .send({ nombre: 'Blusa', subcategoriaId: subcategoria.id, stockInicial: 5 })
  ).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const vender = (datos: object) => agente.post('/api/v1/ventas').send(datos);
const stockDe = async (id: number) =>
  (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock;

describe('registrar venta', () => {
  it('V01 y V02: registra una venta menor al stock y descuenta automáticamente', async () => {
    const res = await vender({ productoId: producto.id, cantidad: 2 });
    expect(res.status).toBe(201);
    expect(res.body.stockActual).toBe(3);
    expect(await stockDe(producto.id)).toBe(3);
  });

  it('V01: permite vender exactamente todo el stock', async () => {
    const res = await vender({ productoId: producto.id, cantidad: 5 });
    expect(res.status).toBe(201);
    expect(await stockDe(producto.id)).toBe(0);
  });

  it('V03: guarda la fecha del servidor y no la expone ni la acepta', async () => {
    const antes = Date.now();
    const res = await vender({ productoId: producto.id, cantidad: 1 });
    expect(res.body.venta.fecha).toBeUndefined();
    const fila = await prisma.venta.findFirstOrThrow({ where: { productoId: producto.id } });
    expect(fila.fecha.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(fila.fecha.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    const forzada = await vender({ productoId: producto.id, cantidad: 1, fecha: '2020-01-01' });
    expect(forzada.status).toBe(422);
  });

  it('V04: rechaza una cantidad mayor al stock, no cambia el stock y no guarda la venta', async () => {
    const res = await vender({ productoId: producto.id, cantidad: 6 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.errors[0]).toMatchObject({
      field: 'cantidad',
      message: 'Solo hay 5 unidades disponibles.',
    });
    expect(await stockDe(producto.id)).toBe(5);
    expect(await prisma.venta.count()).toBe(0);
  });

  it('mensaje claro cuando no hay unidades', async () => {
    await vender({ productoId: producto.id, cantidad: 5 });
    const res = await vender({ productoId: producto.id, cantidad: 1 });
    expect(res.body.errors[0].message).toBe('Este producto no tiene unidades disponibles.');
  });

  it('V05: rechaza cantidad cero, negativa o decimal', async () => {
    for (const cantidad of [0, -1, 1.5]) {
      const res = await vender({ productoId: producto.id, cantidad });
      expect(res.status).toBe(422);
      expect(res.body.errors[0].field).toBe('cantidad');
    }
    expect(await stockDe(producto.id)).toBe(5);
  });

  it('V06: rechaza una venta sin producto', async () => {
    const res = await vender({ cantidad: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('productoId');
  });

  it('rechaza un producto inexistente, ajeno o inactivo', async () => {
    expect((await vender({ productoId: 99999, cantidad: 1 })).status).toBe(404);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajeno = await otra.post('/api/v1/ventas').send({ productoId: producto.id, cantidad: 1 });
    expect(ajeno.status).toBe(404);
    expect(await stockDe(producto.id)).toBe(5);
    await agente.delete(`/api/v1/productos/${producto.id}`);
    const inactivo = await vender({ productoId: producto.id, cantidad: 1 });
    expect(inactivo.status).toBe(422);
    expect(inactivo.body.code).toBe('INACTIVE_RESOURCE');
  });

  it('V07: ventas simultáneas nunca dejan el stock negativo', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => vender({ productoId: producto.id, cantidad: 2 })),
    );
    expect(resultados.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await stockDe(producto.id)).toBe(1);
    expect(await prisma.venta.count()).toBe(2);
  });

  it('exige sesión', async () => {
    const res = await request(app).post('/api/v1/ventas').send({ productoId: 1, cantidad: 1 });
    expect(res.status).toBe(401);
  });
});
