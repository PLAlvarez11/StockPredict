import request from 'supertest';
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

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  ropa = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const crear = (datos: object) => agente.post('/api/v1/subcategorias').send(datos);
const nueva = (nombre: string, extra: object = {}) =>
  crear({ categoriaId: ropa.categoria.id, nombre, ...extra });
const producto = (nombre: string, subcategoriaId: number, stockInicial = 1) =>
  agente.post('/api/v1/productos').send({ nombre, subcategoriaId, stockInicial });

describe('subcategorías', () => {
  it('SC01: crea una subcategoría sin ícono y hereda el de su categoría', async () => {
    const res = await nueva(' Pantalones ');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Pantalones',
      categoriaId: ropa.categoria.id,
      icono: 't-shirt',
      iconoPropio: null,
      estado: true,
      totalProductos: 0,
    });
  });

  it('SC02: con ícono propio lo usa; al quitarlo vuelve a heredar el de la categoría', async () => {
    const { body } = await nueva('Vestidos', { icono: 'dress' });
    expect(body).toMatchObject({ icono: 'dress', iconoPropio: 'dress' });
    const sinIcono = await agente.patch(`/api/v1/subcategorias/${body.id}`).send({ icono: null });
    expect(sinIcono.body).toMatchObject({ icono: 't-shirt', iconoPropio: null });
  });

  it('SC03: si la categoría cambia de ícono, las subcategorías sin ícono propio lo siguen', async () => {
    const { body } = await nueva('Pantalones');
    await agente.patch(`/api/v1/categorias/${ropa.categoria.id}`).send({ icono: 'dress' });
    const res = await agente.get(`/api/v1/subcategorias/${body.id}`);
    expect(res.body.icono).toBe('dress');
    const producto1 = await producto('Pantalón', body.id);
    expect(producto1.body.subcategoria.icono).toBe('dress');
  });

  it('SC04: rechaza nombre vacío, ícono fuera de la lista y campos desconocidos', async () => {
    const sinNombre = await nueva('   ');
    expect(sinNombre.status).toBe(422);
    expect(sinNombre.body.errors[0].field).toBe('nombre');
    expect((await nueva('X', { icono: 'rocket' })).status).toBe(422);
    expect((await nueva('X', { usuarioId: 99 })).status).toBe(422);
    expect((await nueva('X', { estado: false })).status).toBe(422);
  });

  it('SC05: la categoría es obligatoria y debe ser propia y activa', async () => {
    expect((await crear({ nombre: 'X' })).status).toBe(422);
    expect((await crear({ categoriaId: 9999, nombre: 'X' })).status).toBe(422);
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const ajena = await crearCatalogoDePrueba(otra, 'Ajena', 'Sub ajena', 'tag');
    expect((await crear({ categoriaId: ajena.categoria.id, nombre: 'X' })).status).toBe(422);
    const vacia = (await agente.post('/api/v1/categorias').send({ nombre: 'Vacía', icono: 'tag' }))
      .body;
    await agente.delete(`/api/v1/categorias/${vacia.id}`);
    expect((await crear({ categoriaId: vacia.id, nombre: 'X' })).status).toBe(422);
  });

  it('SC06: el nombre es único dentro de su categoría entre las activas, no entre categorías', async () => {
    const primera = (await nueva('Pantalones')).body;
    const repetida = await nueva('PANTALONES');
    expect(repetida.status).toBe(409);
    expect(repetida.body.code).toBe('DUPLICATE_NAME');
    const bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
    expect((await crear({ categoriaId: bolsos.categoria.id, nombre: 'Pantalones' })).status).toBe(
      201,
    );
    await agente.delete(`/api/v1/subcategorias/${primera.id}`);
    expect((await nueva('Pantalones')).status).toBe(201);
  });

  it('SC07: edita el nombre, con control de nombre repetido, y no permite cambiar de categoría', async () => {
    const { body } = await nueva('Pantalones');
    const res = await agente.patch(`/api/v1/subcategorias/${body.id}`).send({ nombre: 'Jeans' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Jeans');
    expect(
      (await agente.patch(`/api/v1/subcategorias/${body.id}`).send({ nombre: 'blusas' })).status,
    ).toBe(409);
    expect(
      (await agente.patch(`/api/v1/subcategorias/${body.id}`).send({ categoriaId: 5 })).status,
    ).toBe(422);
    expect((await agente.patch(`/api/v1/subcategorias/${body.id}`).send({})).status).toBe(422);
  });

  it('SC08: no inactiva una subcategoría con productos activos, y sí cuando no le quedan', async () => {
    const p = (await producto('Blusa', ropa.subcategoria.id)).body;
    const bloqueada = await agente.delete(`/api/v1/subcategorias/${ropa.subcategoria.id}`);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.code).toBe('SUBCATEGORY_HAS_ACTIVE_PRODUCTS');
    expect(bloqueada.body.detail).toContain('1 producto activo');
    await agente.delete(`/api/v1/productos/${p.id}`);
    expect((await agente.delete(`/api/v1/subcategorias/${ropa.subcategoria.id}`)).status).toBe(204);
    const fila = await prisma.subcategoria.findUniqueOrThrow({
      where: { id: ropa.subcategoria.id },
    });
    expect(fila.estado).toBe(false);
  });

  it('SC09: lista por categoría y por estado, con el conteo de productos activos', async () => {
    await nueva('Pantalones');
    await producto('Blusa A', ropa.subcategoria.id);
    const b = (await producto('Blusa B', ropa.subcategoria.id)).body;
    await agente.delete(`/api/v1/productos/${b.id}`);
    const bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
    const lista = await agente.get(`/api/v1/subcategorias?categoriaId=${ropa.categoria.id}`);
    expect(lista.body.map((s: { nombre: string }) => s.nombre)).toEqual(['Blusas', 'Pantalones']);
    expect(lista.body[0].totalProductos).toBe(1);
    expect((await agente.get('/api/v1/subcategorias')).body).toHaveLength(3);
    await agente.delete(`/api/v1/subcategorias/${bolsos.subcategoria.id}`);
    expect((await agente.get('/api/v1/subcategorias?estado=inactivos')).body).toHaveLength(1);
    expect((await agente.get('/api/v1/subcategorias?estado=todos')).body).toHaveLength(3);
    expect((await agente.get('/api/v1/subcategorias?usuarioId=1')).status).toBe(422);
  });

  it('SC10: activa una subcategoría inactiva, salvo que su categoría esté inactiva o el nombre esté en uso', async () => {
    const { body } = await nueva('Pantalones');
    await agente.delete(`/api/v1/subcategorias/${body.id}`);
    const activa = await agente.post(`/api/v1/subcategorias/${body.id}/activar`);
    expect(activa.status).toBe(200);
    expect(activa.body.estado).toBe(true);

    await agente.delete(`/api/v1/subcategorias/${body.id}`);
    await nueva('Pantalones');
    expect((await agente.post(`/api/v1/subcategorias/${body.id}/activar`)).status).toBe(409);

    const bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
    await agente.delete(`/api/v1/subcategorias/${bolsos.subcategoria.id}`);
    await agente.delete(`/api/v1/categorias/${bolsos.categoria.id}`);
    const sinCategoria = await agente.post(
      `/api/v1/subcategorias/${bolsos.subcategoria.id}/activar`,
    );
    expect(sinCategoria.status).toBe(422);
    expect(sinCategoria.body.code).toBe('INACTIVE_RESOURCE');
  });

  it('SC11: aísla por usuario: lo ajeno responde 404 y la lista no lo muestra', async () => {
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    const id = ropa.subcategoria.id;
    expect((await otra.get('/api/v1/subcategorias')).body).toEqual([]);
    expect((await otra.get(`/api/v1/subcategorias?categoriaId=${ropa.categoria.id}`)).body).toEqual(
      [],
    );
    expect((await otra.get(`/api/v1/subcategorias/${id}`)).status).toBe(404);
    expect((await otra.patch(`/api/v1/subcategorias/${id}`).send({ nombre: 'X' })).status).toBe(
      404,
    );
    expect((await otra.delete(`/api/v1/subcategorias/${id}`)).status).toBe(404);
    expect((await otra.post(`/api/v1/subcategorias/${id}/activar`)).status).toBe(404);
    const fila = await prisma.subcategoria.findUniqueOrThrow({ where: { id } });
    expect(fila).toMatchObject({ nombre: 'Blusas', estado: true });
  });

  it('SC12: exige sesión y valida el identificador', async () => {
    expect((await request(app).get('/api/v1/subcategorias')).status).toBe(401);
    expect((await request(app).post('/api/v1/subcategorias').send({})).status).toBe(401);
    expect((await agente.get('/api/v1/subcategorias/abc')).status).toBe(422);
  });
});
