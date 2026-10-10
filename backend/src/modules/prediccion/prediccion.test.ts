import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CONTRASENA_DEMO, CORREO_DEMO, sembrarDemo } from '../../../prisma/demo.js';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { semanasCerradas } from '../../shared/time/semana.js';
import { crearMailerFalso, limpiarBase } from '../../../test/helpers.js';
import { calcularPrediccion } from './prediccion.service.js';

const ZONA = 'America/Guatemala';
const AHORA = new Date('2026-10-09T15:00:00Z');

let usuarioId: number;

beforeEach(async () => {
  await limpiarBase();
  usuarioId = (await sembrarDemo(AHORA)).usuarioId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const buscar = async (nombre: string, ahora = AHORA) => {
  const resultado = await calcularPrediccion(usuarioId, ahora, ZONA);
  const item = resultado.items.find((i) => i.producto.nombre === nombre);
  if (!item) throw new Error(`No aparece ${nombre}`);
  return { item, resultado };
};

describe('predicción con el seed de la demo', () => {
  it('PR01/PR03: Blusa floral V1=8, V2=6, V3=5, stock 3 → sugerido 10, comprar 7', async () => {
    const { item } = await buscar('Blusa floral');
    expect(item.estado).toBe('comprar');
    expect(item.origen).toBe('producto');
    expect(item.stockSugerido).toBe(10);
    expect(item.cantidadAComprar).toBe(7);
    expect(item.calculo).toMatchObject({ v1: 8, v2: 6, v3: 5, margen: 0.2, cantidadAComprar: 7 });
    expect(item.calculo?.ponderado).toBeCloseTo(6.8, 10);
    expect(item.calculo?.factorAjustado).toBeCloseTo(1.1667, 4);
  });

  it('PR04: producto con stock suficiente no necesita compra', async () => {
    const { item } = await buscar('Vestido casual midi');
    expect(item.estado).toBe('suficiente');
    expect(item.cantidadAComprar).toBe(0);
    expect(item.stockSugerido).toBeLessThan(item.stockActual);
  });

  it('PR02: producto nuevo de esta semana usa el promedio por producto de su categoría', async () => {
    const { item } = await buscar('Blusa de lino');
    expect(item.origen).toBe('categoria');
    expect(item.estado).toBe('comprar');
    expect(item.calculo?.productosBase).toBe(2);
    expect(item.calculo).toMatchObject({ v1: 7, v2: 5.5, v3: 4.5 });
    expect(item.stockSugerido).toBe(9);
    expect(item.cantidadAComprar).toBe(5);
  });

  it('PR05: producto nuevo en una categoría sin historial muestra "sin historial"', async () => {
    const { item } = await buscar('Sandalia dorada');
    expect(item.estado).toBe('sin_historial');
    expect(item.origen).toBeNull();
    expect(item.stockSugerido).toBeNull();
    expect(item.cantidadAComprar).toBeNull();
    expect(item.calculo).toBeNull();
  });

  it('producto con V2 = 0 usa factor 1', async () => {
    const { item } = await buscar('Collar dorado charm');
    expect(item.calculo).toMatchObject({
      v1: 5,
      v2: 0,
      v3: 3,
      factorTendencia: 1,
      factorAjustado: 1,
    });
    expect(item.stockSugerido).toBe(4);
    expect(item.cantidadAComprar).toBe(3);
  });

  it('ordena comprar (mayor cantidad primero), luego suficiente y por último sin historial', async () => {
    const { resultado } = await buscar('Blusa floral');
    const estados = resultado.items.map((i) => i.estado);
    expect(estados.lastIndexOf('comprar')).toBeLessThan(estados.indexOf('suficiente'));
    expect(estados.lastIndexOf('suficiente')).toBeLessThan(estados.indexOf('sin_historial'));
    const cantidades = resultado.items
      .filter((i) => i.estado === 'comprar')
      .map((i) => i.cantidadAComprar ?? 0);
    expect(cantidades).toEqual([...cantidades].sort((a, b) => b - a));
    expect(resultado.totalActivos).toBe(14);
    expect(resultado.totalAComprar).toBe(cantidades.length);
  });

  it('las ventas de la semana en curso no entran al cálculo', async () => {
    const antes = (await buscar('Blusa floral')).item.stockSugerido;
    const blusa = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Blusa floral' } });
    await prisma.venta.create({ data: { productoId: blusa.id, cantidad: 500, fecha: AHORA } });
    expect((await buscar('Blusa floral')).item.stockSugerido).toBe(antes);
  });

  it('los productos inactivos se excluyen y no cuentan como base de la categoría', async () => {
    const vestido = await prisma.producto.findFirstOrThrow({
      where: { nombre: 'Vestido casual midi' },
    });
    await prisma.producto.update({ where: { id: vestido.id }, data: { estado: false } });
    const { item, resultado } = await buscar('Blusa de lino');
    expect(resultado.items.some((i) => i.producto.nombre === 'Vestido casual midi')).toBe(false);
    expect(resultado.totalActivos).toBe(13);
    expect(item.calculo?.productosBase).toBe(1);
    expect(item.calculo).toMatchObject({ v1: 8, v2: 6, v3: 5 });
  });

  it('si la categoría no tiene ninguna venta en las 3 semanas, no hay historial', async () => {
    await prisma.venta.deleteMany({ where: { producto: { categoria: { nombre: 'Ropa' } } } });
    const { item } = await buscar('Blusa de lino');
    expect(item.estado).toBe('sin_historial');
  });

  it('una venta el domingo 23:59 (Guatemala) cuenta en V1 y la del lunes 00:00 no', async () => {
    const blusa = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Blusa floral' } });
    const w1 = semanasCerradas(AHORA, ZONA, 1)[0];
    if (!w1) throw new Error('sin semana');
    await prisma.venta.createMany({
      data: [
        { productoId: blusa.id, cantidad: 2, fecha: new Date(w1.fin.getTime() - 1) },
        { productoId: blusa.id, cantidad: 40, fecha: w1.fin },
      ],
    });
    expect((await buscar('Blusa floral')).item.calculo).toMatchObject({ v1: 10, v2: 6, v3: 5 });
  });
});

describe('GET /api/v1/prediccion', () => {
  it('exige sesión', async () => {
    const res = await request(crearApp({ mailer: crearMailerFalso() })).get('/api/v1/prediccion');
    expect(res.status).toBe(401);
  });

  it('devuelve la predicción y refleja una venta nueva en el stock actual', async () => {
    await sembrarDemo();
    const agente = request.agent(crearApp({ mailer: crearMailerFalso() }));
    const login = await agente
      .post('/api/v1/auth/login')
      .send({ correo: CORREO_DEMO, contrasena: CONTRASENA_DEMO });
    expect(login.status).toBe(200);

    const nombreDe = (i: { producto: { nombre: string } }) => i.producto.nombre === 'Blusa floral';
    const antes = await agente.get('/api/v1/prediccion');
    expect(antes.status).toBe(200);
    expect(antes.body.items.find(nombreDe)).toMatchObject({
      stockActual: 3,
      stockSugerido: 10,
      cantidadAComprar: 7,
      estado: 'comprar',
    });

    const lista = await agente.get('/api/v1/productos');
    const blusa = lista.body.datos.find((p: { nombre: string }) => p.nombre === 'Blusa floral');
    const venta = await agente.post('/api/v1/ventas').send({ productoId: blusa.id, cantidad: 1 });
    expect(venta.status).toBe(201);

    const despues = await agente.get('/api/v1/prediccion');
    expect(despues.body.items.find(nombreDe)).toMatchObject({
      stockActual: 2,
      stockSugerido: 10,
      cantidadAComprar: 8,
    });
  });
});
