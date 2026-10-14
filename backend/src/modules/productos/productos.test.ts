import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { crearMailerFalso, iniciarSesionDePrueba, limpiarBase } from '../../../test/helpers.js';

const app = crearApp({ mailer: crearMailerFalso() });
let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let ropa: { id: number };
let bolsos: { id: number };

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  ropa = (await agente.post('/api/v1/categorias').send({ nombre: 'Ropa', icono: 't-shirt' })).body;
  bolsos = (
    await agente.post('/api/v1/categorias').send({ nombre: 'Bolsos', icono: 'handbag-simple' })
  ).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const crear = (datos: object) => agente.post('/api/v1/productos').send(datos);

describe('productos', () => {
  it('P01: crea un producto con nombre, categoría y stock inicial válidos', async () => {
    const res = await crear({ nombre: 'Blusa floral', categoriaId: ropa.id, stockInicial: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Blusa floral',
      stock: 4,
      nivelStock: 'ok',
      categoria: { id: ropa.id, nombre: 'Ropa', icono: 't-shirt' },
    });
    expect(res.body.nivelStock).toBe('ok');
  });

  it('calcula el nivel de stock con el umbral configurado (rojo = 0, ámbar 1–3, verde > 3)', async () => {
    const niveles = new Map<number, string>();
    for (const stock of [0, 1, 3, 4]) {
      const res = await crear({
        nombre: `Producto ${stock}`,
        categoriaId: ropa.id,
        stockInicial: stock,
      });
      niveles.set(stock, res.body.nivelStock);
    }
    expect(Object.fromEntries(niveles)).toEqual({ 0: 'agotado', 1: 'bajo', 3: 'bajo', 4: 'ok' });
  });

  it('RF28: el listado informa cuántos productos activos tienen stock bajo (≤ 3, incluye agotados)', async () => {
    for (const stock of [0, 1, 3, 4, 20]) {
      await crear({ nombre: `Producto ${stock}`, categoriaId: ropa.id, stockInicial: stock });
    }
    const inactivo = (await crear({ nombre: 'Inactivo', categoriaId: ropa.id, stockInicial: 0 }))
      .body;
    await agente.delete(`/api/v1/productos/${inactivo.id}`);
    const todos = await agente.get('/api/v1/productos');
    expect(todos.body.total).toBe(5);
    expect(todos.body.stockBajo).toBe(3);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    expect((await otra.get('/api/v1/productos')).body.stockBajo).toBe(0);
  });

  it('P02 y P03: edita nombre y categoría sin tocar el stock', async () => {
    const { body } = await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 7 });
    const res = await agente
      .patch(`/api/v1/productos/${body.id}`)
      .send({ nombre: 'Blusa floral', categoriaId: bolsos.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: 'Blusa floral',
      stock: 7,
      categoria: { id: bolsos.id },
    });
  });

  it('no permite editar el stock desde el producto', async () => {
    const { body } = await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 7 });
    const res = await agente.patch(`/api/v1/productos/${body.id}`).send({ stock: 99 });
    expect(res.status).toBe(422);
  });

  it('P04: inactiva un producto y deja de listarse', async () => {
    const { body } = await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 7 });
    expect((await agente.delete(`/api/v1/productos/${body.id}`)).status).toBe(204);
    const lista = await agente.get('/api/v1/productos');
    expect(lista.body.datos).toEqual([]);
    expect((await agente.get(`/api/v1/productos/${body.id}`)).status).toBe(404);
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: body.id } });
    expect(fila.estado).toBe(false);
  });

  it('P05: lista productos filtrados por categoría', async () => {
    await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 1 });
    await crear({ nombre: 'Vestido', categoriaId: ropa.id, stockInicial: 1 });
    await crear({ nombre: 'Tote', categoriaId: bolsos.id, stockInicial: 1 });
    const todos = await agente.get('/api/v1/productos');
    expect(todos.body.total).toBe(3);
    const filtrados = await agente.get(`/api/v1/productos?categoriaId=${ropa.id}`);
    expect(filtrados.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Blusa',
      'Vestido',
    ]);
    const buscados = await agente.get('/api/v1/productos?q=tot');
    expect(buscados.body.datos).toHaveLength(1);
  });

  it('P06: rechaza un producto sin nombre', async () => {
    const res = await crear({ nombre: '', categoriaId: ropa.id, stockInicial: 1 });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('nombre');
  });

  it('P07: rechaza un producto sin categoría o con una categoría inexistente, ajena o inactiva', async () => {
    expect((await crear({ nombre: 'X', stockInicial: 1 })).status).toBe(422);
    expect((await crear({ nombre: 'X', categoriaId: 9999, stockInicial: 1 })).status).toBe(422);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajena = await otra.post('/api/v1/categorias').send({ nombre: 'Ajena', icono: 'tag' });
    expect((await crear({ nombre: 'X', categoriaId: ajena.body.id, stockInicial: 1 })).status).toBe(
      422,
    );
    const vacia = (await agente.post('/api/v1/categorias').send({ nombre: 'Vacía', icono: 'tag' }))
      .body;
    await agente.delete(`/api/v1/categorias/${vacia.id}`);
    expect((await crear({ nombre: 'X', categoriaId: vacia.id, stockInicial: 1 })).status).toBe(422);
  });

  it('P08: rechaza stock inicial negativo, decimal o ausente', async () => {
    expect((await crear({ nombre: 'X', categoriaId: ropa.id, stockInicial: -1 })).status).toBe(422);
    expect((await crear({ nombre: 'X', categoriaId: ropa.id, stockInicial: 1.5 })).status).toBe(
      422,
    );
    expect((await crear({ nombre: 'X', categoriaId: ropa.id })).status).toBe(422);
  });

  it('acepta stock inicial 0', async () => {
    const res = await crear({ nombre: 'X', categoriaId: ropa.id, stockInicial: 0 });
    expect(res.status).toBe(201);
    expect(res.body.nivelStock).toBe('agotado');
  });

  it('P09: rechaza nombres repetidos entre productos activos', async () => {
    await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 1 });
    const res = await crear({ nombre: 'blusa', categoriaId: bolsos.id, stockInicial: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });

  it('aísla los datos por usuario: lo ajeno responde 404', async () => {
    const { body } = await crear({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 1 });
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    expect((await otra.get('/api/v1/productos')).body.total).toBe(0);
    expect((await otra.get(`/api/v1/productos/${body.id}`)).status).toBe(404);
    expect((await otra.patch(`/api/v1/productos/${body.id}`).send({ nombre: 'Z' })).status).toBe(
      404,
    );
    expect((await otra.delete(`/api/v1/productos/${body.id}`)).status).toBe(404);
  });

  it('valida la paginación', async () => {
    const res = await agente.get('/api/v1/productos?limit=1000');
    expect(res.status).toBe(422);
  });
});
