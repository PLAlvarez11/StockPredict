import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import {
  crearCatalogoDePrueba,
  crearMailerFalso,
  iniciarSesionDePrueba,
  limpiarBase,
  type Catalogo,
} from '../../../test/helpers.js';

const app = crearApp({ mailer: crearMailerFalso() });
let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let ropa: Catalogo;
let bolsos: Catalogo;

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  ropa = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
  bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const crear = (datos: object) => agente.post('/api/v1/productos').send(datos);
const nuevo = (nombre: string, stockInicial = 1, catalogo: Catalogo = ropa, extra: object = {}) =>
  crear({ nombre, subcategoriaId: catalogo.subcategoria.id, stockInicial, ...extra });

describe('productos', () => {
  it('P01: crea un producto con nombre, subcategoría y stock inicial válidos', async () => {
    const res = await nuevo('Blusa floral', 4);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Blusa floral',
      descripcion: null,
      stock: 4,
      estado: true,
      nivelStock: 'ok',
      categoria: { id: ropa.categoria.id, nombre: 'Ropa', icono: 't-shirt' },
      subcategoria: { id: ropa.subcategoria.id, nombre: 'Blusas', icono: 't-shirt' },
    });
  });

  it('guarda la descripción recortada, y una descripción vacía queda en null', async () => {
    const con = await nuevo('Blusa floral', 4, ropa, { descripcion: '  Algodón, manga corta  ' });
    expect(con.body.descripcion).toBe('Algodón, manga corta');
    const vacia = await nuevo('Blusa lisa', 4, ropa, { descripcion: '   ' });
    expect(vacia.body.descripcion).toBeNull();
  });

  it('P10: acepta una descripción de 500 caracteres y rechaza una de 501', async () => {
    expect((await nuevo('Blusa A', 1, ropa, { descripcion: 'a'.repeat(500) })).status).toBe(201);
    const larga = await nuevo('Blusa B', 1, ropa, { descripcion: 'a'.repeat(501) });
    expect(larga.status).toBe(422);
    expect(larga.body.errors[0].field).toBe('descripcion');
  });

  it('la categoría del producto se obtiene de su subcategoría y no se acepta categoriaId', async () => {
    const res = await crear({
      nombre: 'Tote',
      subcategoriaId: bolsos.subcategoria.id,
      categoriaId: ropa.categoria.id,
      stockInicial: 1,
    });
    expect(res.status).toBe(422);
    const ok = await nuevo('Tote', 1, bolsos);
    expect(ok.body.categoria.id).toBe(bolsos.categoria.id);
  });

  it('calcula el nivel de stock con el umbral configurado (rojo = 0, ámbar 1–3, verde > 3)', async () => {
    const niveles = new Map<number, string>();
    for (const stock of [0, 1, 3, 4]) {
      const res = await nuevo(`Producto ${stock}`, stock);
      niveles.set(stock, res.body.nivelStock);
    }
    expect(Object.fromEntries(niveles)).toEqual({ 0: 'agotado', 1: 'bajo', 3: 'bajo', 4: 'ok' });
  });

  it('RF28: el listado informa cuántos productos activos tienen stock bajo (≤ 3, incluye agotados)', async () => {
    for (const stock of [0, 1, 3, 4, 20]) await nuevo(`Producto ${stock}`, stock);
    const inactivo = (await nuevo('Inactivo', 0)).body;
    await agente.delete(`/api/v1/productos/${inactivo.id}`);
    const todos = await agente.get('/api/v1/productos');
    expect(todos.body.total).toBe(5);
    expect(todos.body.stockBajo).toBe(3);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    expect((await otra.get('/api/v1/productos')).body.stockBajo).toBe(0);
  });

  it('P13: un producto desactivado no entra al conteo de stock bajo, aunque se listen los inactivos', async () => {
    await nuevo('Activo bajo', 1);
    const inactivo = (await nuevo('Inactivo agotado', 0)).body;
    await agente.delete(`/api/v1/productos/${inactivo.id}`);
    const inactivos = await agente.get('/api/v1/productos?estado=inactivos');
    expect(inactivos.body.total).toBe(1);
    expect(inactivos.body.stockBajo).toBe(1);
    const activos = await agente.get('/api/v1/productos');
    expect(activos.body.stockBajo).toBe(1);
  });

  it('P02 y P03: edita nombre, subcategoría y descripción sin tocar el stock', async () => {
    const { body } = await nuevo('Blusa', 7);
    const res = await agente.patch(`/api/v1/productos/${body.id}`).send({
      nombre: 'Blusa floral',
      subcategoriaId: bolsos.subcategoria.id,
      descripcion: 'Nueva descripción',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: 'Blusa floral',
      stock: 7,
      descripcion: 'Nueva descripción',
      categoria: { id: bolsos.categoria.id },
      subcategoria: { id: bolsos.subcategoria.id },
    });
    const sinDescripcion = await agente
      .patch(`/api/v1/productos/${body.id}`)
      .send({ descripcion: null });
    expect(sinDescripcion.body.descripcion).toBeNull();
  });

  it('no permite editar el stock desde el producto', async () => {
    const { body } = await nuevo('Blusa', 7);
    const res = await agente.patch(`/api/v1/productos/${body.id}`).send({ stock: 99 });
    expect(res.status).toBe(422);
  });

  it('P04: inactiva un producto y deja de listarse entre los activos', async () => {
    const { body } = await nuevo('Blusa', 7);
    expect((await agente.delete(`/api/v1/productos/${body.id}`)).status).toBe(204);
    const lista = await agente.get('/api/v1/productos');
    expect(lista.body.datos).toEqual([]);
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: body.id } });
    expect(fila.estado).toBe(false);
  });

  it('el filtro estado lista activos, inactivos o todos', async () => {
    await nuevo('Activo');
    const inactivo = (await nuevo('Inactivo')).body;
    await agente.delete(`/api/v1/productos/${inactivo.id}`);
    const nombres = async (estado: string) =>
      (await agente.get(`/api/v1/productos?estado=${estado}`)).body.datos.map(
        (p: { nombre: string }) => p.nombre,
      );
    expect(await nombres('activos')).toEqual(['Activo']);
    expect(await nombres('inactivos')).toEqual(['Inactivo']);
    expect(await nombres('todos')).toEqual(['Activo', 'Inactivo']);
    expect((await agente.get('/api/v1/productos?estado=otro')).status).toBe(422);
  });

  it('P11: activa un producto inactivo y vuelve a las listas', async () => {
    const { body } = await nuevo('Blusa', 7);
    await agente.delete(`/api/v1/productos/${body.id}`);
    const res = await agente.post(`/api/v1/productos/${body.id}/activar`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: body.id, estado: true, stock: 7 });
    expect((await agente.get('/api/v1/productos')).body.total).toBe(1);
  });

  it('P12: no activa un producto si su subcategoría está inactiva, ni si otro activo usa su nombre', async () => {
    const { body } = await nuevo('Blusa', 7);
    await agente.delete(`/api/v1/productos/${body.id}`);
    await agente.delete(`/api/v1/subcategorias/${ropa.subcategoria.id}`);
    const sinSub = await agente.post(`/api/v1/productos/${body.id}/activar`);
    expect(sinSub.status).toBe(422);
    expect(sinSub.body.code).toBe('INACTIVE_RESOURCE');
    await agente.post(`/api/v1/subcategorias/${ropa.subcategoria.id}/activar`);
    await nuevo('Blusa', 2);
    const repetido = await agente.post(`/api/v1/productos/${body.id}/activar`);
    expect(repetido.status).toBe(409);
    expect(repetido.body.code).toBe('DUPLICATE_NAME');
  });

  it('P05: lista productos filtrados por categoría y por subcategoría', async () => {
    await nuevo('Blusa');
    await nuevo('Vestido');
    await nuevo('Tote', 1, bolsos);
    const todos = await agente.get('/api/v1/productos');
    expect(todos.body.total).toBe(3);
    const porCategoria = await agente.get(`/api/v1/productos?categoriaId=${ropa.categoria.id}`);
    expect(porCategoria.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual([
      'Blusa',
      'Vestido',
    ]);
    const porSub = await agente.get(`/api/v1/productos?subcategoriaId=${bolsos.subcategoria.id}`);
    expect(porSub.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual(['Tote']);
    expect((await agente.get('/api/v1/productos?q=tot')).body.datos).toHaveLength(1);
  });

  it('P06: rechaza un producto sin nombre', async () => {
    const res = await nuevo('');
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('nombre');
  });

  it('P07: rechaza un producto sin subcategoría o con una inexistente, ajena o inactiva', async () => {
    expect((await crear({ nombre: 'X', stockInicial: 1 })).status).toBe(422);
    expect((await crear({ nombre: 'X', subcategoriaId: 9999, stockInicial: 1 })).status).toBe(422);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajena = await crearCatalogoDePrueba(otra, 'Ajena', 'Ajena sub', 'tag');
    expect((await nuevo('X', 1, ajena)).status).toBe(422);
    const vacia = await crearCatalogoDePrueba(agente, 'Vacía', 'Vacía sub', 'tag');
    await agente.delete(`/api/v1/subcategorias/${vacia.subcategoria.id}`);
    expect((await nuevo('X', 1, vacia)).status).toBe(422);
  });

  it('P08: rechaza stock inicial negativo, decimal o ausente', async () => {
    expect((await nuevo('X', -1)).status).toBe(422);
    expect((await nuevo('X', 1.5)).status).toBe(422);
    expect((await crear({ nombre: 'X', subcategoriaId: ropa.subcategoria.id })).status).toBe(422);
  });

  it('acepta stock inicial 0', async () => {
    const res = await nuevo('X', 0);
    expect(res.status).toBe(201);
    expect(res.body.nivelStock).toBe('agotado');
  });

  it('P14: crea el producto desactivado cuando estado es false, sin chocar con un activo del mismo nombre', async () => {
    await nuevo('Blusa floral');
    const res = await nuevo('Blusa floral', 2, ropa, { estado: false });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe(false);
    const activos = await agente.get('/api/v1/productos?estado=activos');
    expect(activos.body.datos).toHaveLength(1);
    const activar = await agente.post(`/api/v1/productos/${res.body.id}/activar`);
    expect(activar.status).toBe(409);
  });

  it('MA-13: editar un producto no acepta estado', async () => {
    const { body } = await nuevo('Blusa');
    const res = await agente.patch(`/api/v1/productos/${body.id}`).send({ estado: false });
    expect(res.status).toBe(422);
  });

  it('P14: estado true o ausente crea activo, y un estado que no es booleano se rechaza', async () => {
    expect((await nuevo('A', 1, ropa, { estado: true })).body.estado).toBe(true);
    expect((await nuevo('B')).body.estado).toBe(true);
    expect((await nuevo('C', 1, ropa, { estado: 'INACTIVO' })).status).toBe(422);
  });

  it('P09: rechaza nombres repetidos entre productos activos', async () => {
    await nuevo('Blusa');
    const res = await nuevo('blusa', 1, bolsos);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });

  it('aísla los datos por usuario: lo ajeno responde 404', async () => {
    const { body } = await nuevo('Blusa');
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    expect((await otra.get('/api/v1/productos')).body.total).toBe(0);
    expect((await otra.get(`/api/v1/productos/${body.id}`)).status).toBe(404);
    expect((await otra.patch(`/api/v1/productos/${body.id}`).send({ nombre: 'Z' })).status).toBe(
      404,
    );
    expect((await otra.delete(`/api/v1/productos/${body.id}`)).status).toBe(404);
    expect((await otra.post(`/api/v1/productos/${body.id}/activar`)).status).toBe(404);
  });

  it('no deja mover un producto a la subcategoría de otro usuario', async () => {
    const { body } = await nuevo('Blusa');
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajena = await crearCatalogoDePrueba(otra, 'Ajena', 'Ajena sub', 'tag');
    const res = await agente
      .patch(`/api/v1/productos/${body.id}`)
      .send({ subcategoriaId: ajena.subcategoria.id });
    expect(res.status).toBe(422);
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: body.id } });
    expect(fila.subcategoriaId).toBe(ropa.subcategoria.id);
  });

  it('valida la paginación y rechaza parámetros desconocidos en la consulta', async () => {
    expect((await agente.get('/api/v1/productos?limit=1000')).status).toBe(422);
    expect((await agente.get('/api/v1/productos?usuarioId=2')).status).toBe(422);
  });
});
