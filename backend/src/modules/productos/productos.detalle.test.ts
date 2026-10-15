import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { inicioSemana, ultimasSemanas } from '../../shared/time/semana.js';
import { productosService } from './productos.service.js';
import {
  crearCatalogoDePrueba,
  crearMailerFalso,
  iniciarSesionDePrueba,
  limpiarBase,
  type Catalogo,
} from '../../../test/helpers.js';

const ZONA = 'America/Guatemala';
const app = crearApp({ mailer: crearMailerFalso() });

let agente: Awaited<ReturnType<typeof iniciarSesionDePrueba>>;
let ropa: Catalogo;

const crearProducto = async (a: typeof agente, catalogo: Catalogo, nombre: string, stock = 3) => {
  const res = await a
    .post('/api/v1/productos')
    .send({ nombre, subcategoriaId: catalogo.subcategoria.id, stockInicial: stock });
  expect(res.status).toBe(201);
  return res.body.id as number;
};

const comprar = (
  productoId: number,
  cantidad: number,
  fecha: Date,
  tipo: 'compra' | 'ajuste' = 'compra',
) =>
  prisma.movimientoInventario.create({
    data: { productoId, tipo, cantidad, stockAnterior: 0, fecha },
  });

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  ropa = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/productos/:id (detalle)', () => {
  it('P15: devuelve el detalle de un producto propio con categoría, subcategoría, descripción, stock y estado', async () => {
    const res = await agente.post('/api/v1/productos').send({
      nombre: 'Blusa floral',
      subcategoriaId: ropa.subcategoria.id,
      descripcion: 'Algodón',
      stockInicial: 3,
    });
    const detalle = await agente.get(`/api/v1/productos/${res.body.id}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body).toMatchObject({
      nombre: 'Blusa floral',
      descripcion: 'Algodón',
      stock: 3,
      estado: true,
      categoria: { nombre: 'Ropa' },
      subcategoria: { nombre: 'Blusas' },
    });
  });

  it('P16: el producto de otro usuario responde 404, igual que uno inexistente', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const idAjeno = await crearProducto(otro, ajeno, 'Blusa ajena');
    const ajenoRes = await agente.get(`/api/v1/productos/${idAjeno}`);
    const inexistente = await agente.get('/api/v1/productos/99999');
    expect(ajenoRes.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(ajenoRes.body.code).toBe(inexistente.body.code);
  });

  it('P17: sin sesión el detalle y las compras responden 401', async () => {
    expect((await request(app).get('/api/v1/productos/1')).status).toBe(401);
    expect((await request(app).get('/api/v1/productos/1/compras')).status).toBe(401);
  });

  it('P18: un producto desactivado se abre y se edita desde el detalle, y sigue fuera de la predicción y del stock bajo', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa vieja', 0);
    await agente.delete(`/api/v1/productos/${id}`);
    expect((await agente.get(`/api/v1/productos/${id}`)).body.estado).toBe(false);
    const editado = await agente
      .patch(`/api/v1/productos/${id}`)
      .send({ nombre: 'Blusa vieja 2', descripcion: 'Descontinuada' });
    expect(editado.status).toBe(200);
    expect(editado.body).toMatchObject({ nombre: 'Blusa vieja 2', estado: false });
    const prediccion = await agente.get('/api/v1/prediccion');
    expect(prediccion.body.totalActivos).toBe(0);
    const listado = await agente.get('/api/v1/productos?estado=activos');
    expect(listado.body).toMatchObject({ total: 0, stockBajo: 0 });
  });

  it('P18: editar un desactivado con el nombre de un activo se permite; al activarlo responde 409', async () => {
    const viejo = await crearProducto(agente, ropa, 'Blusa floral');
    await agente.delete(`/api/v1/productos/${viejo}`);
    await crearProducto(agente, ropa, 'Blusa lila');
    const res = await agente.patch(`/api/v1/productos/${viejo}`).send({ nombre: 'Blusa lila' });
    expect(res.status).toBe(200);
    expect((await agente.post(`/api/v1/productos/${viejo}/activar`)).status).toBe(409);
  });

  it('P19: no se puede editar un producto ajeno ni mover un desactivado a una subcategoría ajena', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const idAjeno = await crearProducto(otro, ajeno, 'Blusa ajena');
    expect((await agente.patch(`/api/v1/productos/${idAjeno}`).send({ nombre: 'X' })).status).toBe(
      404,
    );
    const propio = await crearProducto(agente, ropa, 'Blusa propia');
    await agente.delete(`/api/v1/productos/${propio}`);
    const mover = await agente
      .patch(`/api/v1/productos/${propio}`)
      .send({ subcategoriaId: ajeno.subcategoria.id });
    expect(mover.status).toBe(422);
  });
});

describe('GET /api/v1/productos/:id/compras', () => {
  it('CP01: devuelve 12 semanas de lunes a domingo, con ceros donde no hubo compras, de la más antigua a la actual', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    expect(res.status).toBe(200);
    expect(res.body.semanas).toHaveLength(12);
    expect(res.body.semanas.every((s: { cantidad: number }) => s.cantidad === 0)).toBe(true);
    expect(res.body).toMatchObject({ total: 0, semanaMayor: null });
    const [primera, ultima] = [res.body.semanas[0], res.body.semanas[11]];
    expect(ultima.enCurso).toBe(true);
    expect(primera.enCurso).toBe(false);
    for (const s of res.body.semanas) {
      expect(s.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const dias = (Date.parse(s.fin) - Date.parse(s.inicio)) / 86_400_000;
      expect(dias).toBe(6);
      expect(new Date(`${s.inicio}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('CP02: suma las compras por semana, ignora los ajustes y señala la semana de mayor compra', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    const ahora = new Date();
    const semanas = ultimasSemanas(ahora, ZONA, 12);
    const medio = (i: number) => {
      const s = semanas[i];
      if (!s) throw new Error('sin semana');
      return new Date((s.inicio.getTime() + s.fin.getTime()) / 2);
    };
    await comprar(id, 5, medio(2));
    await comprar(id, 3, medio(2));
    await comprar(id, 10, medio(7));
    await comprar(id, 99, medio(7), 'ajuste');
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    const cantidades = res.body.semanas.map((s: { cantidad: number }) => s.cantidad);
    expect(cantidades).toEqual([0, 0, 8, 0, 0, 0, 0, 10, 0, 0, 0, 0]);
    expect(res.body.total).toBe(18);
    expect(res.body.semanaMayor).toMatchObject({
      cantidad: 10,
      inicio: res.body.semanas[7].inicio,
    });
  });

  it('CP03: una compra hecha por la API cae en la semana en curso', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    expect(
      (await agente.post('/api/v1/inventario/compras').send({ productoId: id, cantidad: 4 }))
        .status,
    ).toBe(201);
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    expect(res.body.semanas[11].cantidad).toBe(4);
    expect(res.body.total).toBe(4);
  });

  it('CP04: los cortes de semana son domingo 23:59 y lunes 00:00 de Guatemala; lo anterior a 12 semanas no cuenta', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    const ahora = new Date();
    const semanas = ultimasSemanas(ahora, ZONA, 12);
    const quinta = semanas[5];
    const sexta = semanas[6];
    const primera = semanas[0];
    if (!quinta || !sexta || !primera) throw new Error('sin semanas');
    await comprar(id, 2, new Date(quinta.fin.getTime() - 1));
    await comprar(id, 7, sexta.inicio);
    await comprar(id, 50, new Date(primera.inicio.getTime() - 1));
    expect(inicioSemana(sexta.inicio, ZONA).getTime()).toBe(sexta.inicio.getTime());
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    const c = res.body.semanas.map((s: { cantidad: number }) => s.cantidad);
    expect(c[5]).toBe(2);
    expect(c[6]).toBe(7);
    expect(res.body.total).toBe(9);
  });

  it('CP05: si dos semanas empatan como la de mayor compra, se señala la primera', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    const semanas = ultimasSemanas(new Date(), ZONA, 12);
    const a = semanas[3];
    const b = semanas[9];
    if (!a || !b) throw new Error('sin semanas');
    await comprar(id, 6, a.inicio);
    await comprar(id, 6, b.inicio);
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    expect(res.body.semanaMayor.inicio).toBe(res.body.semanas[3].inicio);
  });

  it('CP06: el producto de otro usuario o inexistente responde 404 y sus compras no se filtran', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const idAjeno = await crearProducto(otro, ajeno, 'Blusa ajena');
    await comprar(idAjeno, 40, new Date());
    const res = await agente.get(`/api/v1/productos/${idAjeno}/compras`);
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('semanas');
    expect(res.body).not.toHaveProperty('total');
    expect((await agente.get('/api/v1/productos/99999/compras')).status).toBe(404);
  });

  it('CP07: aislamiento: aunque el servicio reciba el id de un producto ajeno, la consulta no devuelve sus movimientos', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const idAjeno = await crearProducto(otro, ajeno, 'Blusa ajena');
    await comprar(idAjeno, 40, new Date());
    const propio = await prisma.usuario.findFirstOrThrow({
      where: { correo: 'prueba@ejemplo.com' },
    });
    await expect(productosService.compras(idAjeno, propio.id)).rejects.toMatchObject({
      status: 404,
    });
    const { productosRepository } = await import('./productos.repository.js');
    const filas = await productosRepository.comprasEntre(
      idAjeno,
      propio.id,
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );
    expect(filas).toEqual([]);
  });

  it('CP08: rechaza parámetros que no existen (zod estricto) e identificadores inválidos', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    expect((await agente.get(`/api/v1/productos/${id}/compras?usuarioId=1`)).status).toBe(422);
    expect((await agente.get(`/api/v1/productos/${id}/compras?semanas=99`)).status).toBe(422);
    expect((await agente.get('/api/v1/productos/abc/compras')).status).toBe(422);
    expect((await agente.get('/api/v1/productos/-1/compras')).status).toBe(422);
  });

  it('CP09: el producto desactivado también muestra sus compras', async () => {
    const id = await crearProducto(agente, ropa, 'Blusa floral');
    await comprar(id, 5, new Date());
    await agente.delete(`/api/v1/productos/${id}`);
    const res = await agente.get(`/api/v1/productos/${id}/compras`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });
});
