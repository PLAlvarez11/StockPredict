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

const productoNuevoEnSubcategoriaNueva = async (subcategoria: string, nombre: string) => {
  const ropa = await prisma.categoria.findFirstOrThrow({ where: { nombre: 'Ropa', usuarioId } });
  const sub = await prisma.subcategoria.create({
    data: { usuarioId, categoriaId: ropa.id, nombre: subcategoria },
  });
  await prisma.producto.create({
    data: { usuarioId, subcategoriaId: sub.id, nombre, stock: 2, creadoEn: AHORA },
  });
  return (await buscar(nombre)).item;
};

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

  it('PR02: producto nuevo de esta semana usa primero el promedio de su subcategoría, con margen de 10 %', async () => {
    const { item } = await buscar('Blusa de lino');
    expect(item.origen).toBe('subcategoria');
    expect(item.estado).toBe('comprar');
    expect(item.calculo?.productosBase).toBe(1);
    expect(item.calculo).toMatchObject({ v1: 8, v2: 6, v3: 5, margenPorCiento: 10 });
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

  it('PR06: producto con V2 = 0 usa factor 1', async () => {
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

  it('PR08: ordena por necesidad porcentual, luego suficiente y por último sin historial', async () => {
    const { resultado } = await buscar('Blusa floral');
    const estados = resultado.items.map((i) => i.estado);
    expect(estados.lastIndexOf('comprar')).toBeLessThan(estados.indexOf('suficiente'));
    expect(estados.lastIndexOf('suficiente')).toBeLessThan(estados.indexOf('sin_historial'));
    const comprar = resultado.items.filter((i) => i.estado === 'comprar');
    const porcentajes = comprar.map((i) => i.necesidadPct ?? 0);
    expect(porcentajes).toEqual([...porcentajes].sort((a, b) => b - a));
    expect(resultado.totalActivos).toBe(14);
    expect(resultado.totalAComprar).toBe(comprar.length);
    expect(resultado.totalFiltrados).toBe(14);
  });

  it('PR07: las ventas de la semana en curso no entran al cálculo', async () => {
    const antes = (await buscar('Blusa floral')).item.stockSugerido;
    const blusa = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Blusa floral' } });
    await prisma.venta.create({ data: { productoId: blusa.id, cantidad: 500, fecha: AHORA } });
    expect((await buscar('Blusa floral')).item.stockSugerido).toBe(antes);
  });

  it('PR07: los productos inactivos se excluyen y no cuentan como base de la categoría', async () => {
    const vestido = await prisma.producto.findFirstOrThrow({
      where: { nombre: 'Vestido casual midi' },
    });
    await prisma.producto.update({ where: { id: vestido.id }, data: { estado: false } });
    const { item, resultado } = await buscar('Blusa de lino');
    expect(resultado.items.some((i) => i.producto.nombre === 'Vestido casual midi')).toBe(false);
    expect(resultado.totalActivos).toBe(13);
    expect(item.calculo?.productosBase).toBe(1);
    expect(item.calculo).toMatchObject({ v1: 8, v2: 6, v3: 5 });
    const faldas = await productoNuevoEnSubcategoriaNueva('Faldas', 'Falda larga');
    expect(faldas.origen).toBe('categoria');
    expect(faldas.calculo).toMatchObject({ productosBase: 1, v1: 8, v2: 6, v3: 5 });
  });

  it('PR07: el producto desactivado (Chaleco, con muchas ventas) no aparece ni entra a los promedios; si se activa, sí cambia el resultado', async () => {
    const abrigos = await prisma.subcategoria.findFirstOrThrow({ where: { nombre: 'Abrigos' } });
    const nuevo = async () => {
      const ya = await prisma.producto.findFirst({ where: { nombre: 'Chaqueta nueva' } });
      if (!ya) {
        await prisma.producto.create({
          data: {
            usuarioId,
            subcategoriaId: abrigos.id,
            nombre: 'Chaqueta nueva',
            stock: 1,
            creadoEn: AHORA,
          },
        });
      }
      return (await buscar('Chaqueta nueva')).item;
    };
    const lino = await buscar('Blusa de lino');
    expect(lino.resultado.items.some((i) => i.producto.nombre.startsWith('Chaleco'))).toBe(false);
    expect(lino.item.calculo?.productosBase).toBe(1);
    const sin = await nuevo();
    expect(sin.origen).toBe('categoria');

    const chaleco = await prisma.producto.findFirstOrThrow({
      where: { nombre: { startsWith: 'Chaleco' } },
    });
    expect(chaleco.estado).toBe(false);
    await prisma.producto.update({ where: { id: chaleco.id }, data: { estado: true } });
    const con = await nuevo();
    expect(con.origen).toBe('subcategoria');
    expect(con.calculo?.productosBase).toBe(1);
    expect(con.stockSugerido).not.toBeNull();
    expect((await buscar('Blusa de lino')).resultado.totalActivos).toBe(16);
  });

  it('PR02: sin datos en la subcategoría el respaldo promedia la categoría completa, con margen de 10 %', async () => {
    const item = await productoNuevoEnSubcategoriaNueva('Faldas', 'Falda larga');
    expect(item.origen).toBe('categoria');
    expect(item.producto.categoria.nombre).toBe('Ropa');
    expect(item.calculo).toMatchObject({
      productosBase: 2,
      v1: 7,
      v2: 5.5,
      v3: 4.5,
      margenPorCiento: 10,
    });
    expect(item.stockSugerido).toBe(8);
    const vestido = (await buscar('Vestido casual midi')).item;
    expect(vestido.producto.subcategoria).toMatchObject({ nombre: 'Vestidos', icono: 'dress' });
  });

  it('si la categoría no tiene ninguna venta en las 3 semanas, no hay historial', async () => {
    await prisma.venta.deleteMany({
      where: { producto: { subcategoria: { categoria: { nombre: 'Ropa' } } } },
    });
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

  it('un producto desactivado no entra al conteo de stock bajo, al resumen ni a la predicción', async () => {
    await sembrarDemo();
    const agente = request.agent(crearApp({ mailer: crearMailerFalso() }));
    await agente
      .post('/api/v1/auth/login')
      .send({ correo: CORREO_DEMO, contrasena: CONTRASENA_DEMO });
    const productos = await agente.get('/api/v1/productos');
    expect(productos.body.total).toBe(14);
    expect(productos.body.stockBajo).toBe(5);
    const inactivos = await agente.get('/api/v1/productos?estado=inactivos');
    expect(inactivos.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Chaleco de lana (descontinuado)',
    ]);
    const prediccion = await agente.get('/api/v1/prediccion');
    expect(prediccion.body.totalActivos).toBe(14);
    const categorias = await agente.get('/api/v1/categorias');
    const ropa = categorias.body.find((c: { nombre: string }) => c.nombre === 'Ropa');
    expect(ropa).toMatchObject({ totalSubcategorias: 4, totalProductos: 3 });
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
