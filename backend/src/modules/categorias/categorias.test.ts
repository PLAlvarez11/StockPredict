import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { crearMailerFalso, iniciarSesionDePrueba, limpiarBase } from '../../../test/helpers.js';

const app = crearApp({ mailer: crearMailerFalso() });
let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const crear = (datos: object) => agente.post('/api/v1/categorias').send(datos);

describe('categorías', () => {
  it('C01: crea una categoría con nombre válido e ícono de la lista', async () => {
    const res = await crear({ nombre: ' Ropa ', icono: 't-shirt' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Ropa', icono: 't-shirt', totalProductos: 0 });
  });

  it('C02 y C03: edita nombre e ícono', async () => {
    const { body } = await crear({ nombre: 'Ropa', icono: 't-shirt' });
    const res = await agente
      .patch(`/api/v1/categorias/${body.id}`)
      .send({ nombre: 'Vestimenta', icono: 'dress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Vestimenta', icono: 'dress' });
  });

  it('C04: inactiva una categoría y deja de listarse', async () => {
    const { body } = await crear({ nombre: 'Ropa', icono: 't-shirt' });
    const res = await agente.delete(`/api/v1/categorias/${body.id}`);
    expect(res.status).toBe(204);
    const lista = await agente.get('/api/v1/categorias');
    expect(lista.body).toEqual([]);
    const fila = await prisma.categoria.findUniqueOrThrow({ where: { id: body.id } });
    expect(fila.estado).toBe(false);
  });

  it('C05: lista solo las categorías activas con su conteo de productos activos', async () => {
    const ropa = (await crear({ nombre: 'Ropa', icono: 't-shirt' })).body;
    await crear({ nombre: 'Bolsos', icono: 'handbag-simple' });
    await agente
      .post('/api/v1/productos')
      .send({ nombre: 'Blusa', categoriaId: ropa.id, stockInicial: 4 });
    const inactiva = (await crear({ nombre: 'Vieja', icono: 'tag' })).body;
    await agente.delete(`/api/v1/categorias/${inactiva.id}`);
    const res = await agente.get('/api/v1/categorias');
    expect(res.body.map((c: { nombre: string }) => c.nombre)).toEqual(['Ropa', 'Bolsos']);
    expect(res.body[0].totalProductos).toBe(1);
    expect(res.body[1].totalProductos).toBe(0);
  });

  it('C06: rechaza una categoría sin nombre', async () => {
    const res = await crear({ nombre: '   ', icono: 't-shirt' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('nombre');
  });

  it('C07: rechaza una categoría sin ícono o con un ícono fuera de la lista', async () => {
    const sin = await crear({ nombre: 'Ropa' });
    expect(sin.status).toBe(422);
    expect(sin.body.errors[0].field).toBe('icono');
    const otro = await crear({ nombre: 'Ropa', icono: 'rocket' });
    expect(otro.status).toBe(422);
  });

  it('rechaza nombres repetidos entre activas sin distinguir mayúsculas, pero permite reutilizar uno inactivo', async () => {
    const primera = (await crear({ nombre: 'Ropa', icono: 't-shirt' })).body;
    const repetida = await crear({ nombre: 'ROPA', icono: 'dress' });
    expect(repetida.status).toBe(409);
    expect(repetida.body.code).toBe('DUPLICATE_NAME');
    await agente.delete(`/api/v1/categorias/${primera.id}`);
    const nueva = await crear({ nombre: 'Ropa', icono: 'dress' });
    expect(nueva.status).toBe(201);
  });

  it('C08: no inactiva una categoría con productos activos (D6) y sí cuando ya no los tiene (D7)', async () => {
    const cat = (await crear({ nombre: 'Ropa', icono: 't-shirt' })).body;
    const prod = (
      await agente
        .post('/api/v1/productos')
        .send({ nombre: 'Blusa', categoriaId: cat.id, stockInicial: 1 })
    ).body;
    const bloqueada = await agente.delete(`/api/v1/categorias/${cat.id}`);
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.body.code).toBe('CATEGORY_HAS_ACTIVE_PRODUCTS');
    await agente.delete(`/api/v1/productos/${prod.id}`);
    const ok = await agente.delete(`/api/v1/categorias/${cat.id}`);
    expect(ok.status).toBe(204);
  });

  it('expone la lista fija de 15 íconos', async () => {
    const res = await agente.get('/api/v1/categorias/iconos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(15);
    expect(res.body).toContain('t-shirt');
  });

  it('exige sesión', async () => {
    const res = await request(app).get('/api/v1/categorias');
    expect(res.status).toBe(401);
  });

  it('aísla los datos por usuario: lo ajeno responde 404', async () => {
    const mia = (await crear({ nombre: 'Ropa', icono: 't-shirt' })).body;
    const otra = await iniciarSesionDePrueba(app, 'otra@ejemplo.com');
    expect((await otra.get('/api/v1/categorias')).body).toEqual([]);
    expect((await otra.get(`/api/v1/categorias/${mia.id}`)).status).toBe(404);
    expect((await otra.patch(`/api/v1/categorias/${mia.id}`).send({ nombre: 'X' })).status).toBe(
      404,
    );
    expect((await otra.delete(`/api/v1/categorias/${mia.id}`)).status).toBe(404);
    const propia = await otra.post('/api/v1/categorias').send({ nombre: 'Ropa', icono: 't-shirt' });
    expect(propia.status).toBe(201);
  });

  it('valida el identificador de la ruta', async () => {
    const res = await agente.get('/api/v1/categorias/abc');
    expect(res.status).toBe(422);
  });
});
