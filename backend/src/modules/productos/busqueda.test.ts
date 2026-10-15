import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { diaLocal, semanaDe } from '../../shared/time/semana.js';
import { ventasService } from '../ventas/ventas.service.js';
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
let bolsos: Catalogo;

const crear = async (a: typeof agente, catalogo: Catalogo, nombre: string, stock = 5) => {
  const res = await a
    .post('/api/v1/productos')
    .send({ nombre, subcategoriaId: catalogo.subcategoria.id, stockInicial: stock });
  expect(res.status).toBe(201);
  return res.body.id as number;
};
const nombres = (res: request.Response) =>
  (res.body.datos as { nombre: string }[]).map((p) => p.nombre);

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  ropa = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
  bolsos = await crearCatalogoDePrueba(agente, 'Bolsos', 'Carteras', 'handbag-simple');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/productos?q= (buscador)', () => {
  it('BU01: busca por nombre, categoría y subcategoría, sin tildes ni mayúsculas', async () => {
    await crear(agente, ropa, 'Camisón de algodón');
    await crear(agente, bolsos, 'Tote lona');
    expect(nombres(await agente.get('/api/v1/productos?q=CAMISON'))).toEqual([
      'Camisón de algodón',
    ]);
    expect(nombres(await agente.get('/api/v1/productos?q=camisón'))).toEqual([
      'Camisón de algodón',
    ]);
    expect(nombres(await agente.get('/api/v1/productos?q=bolsos'))).toEqual(['Tote lona']);
    expect(nombres(await agente.get('/api/v1/productos?q=cartéra'))).toEqual(['Tote lona']);
    expect(nombres(await agente.get('/api/v1/productos?q=blusa'))).toEqual(['Camisón de algodón']);
  });

  it('BU02: sin coincidencias devuelve una lista vacía con total 0', async () => {
    await crear(agente, ropa, 'Blusa floral');
    const res = await agente.get('/api/v1/productos?q=zzz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ datos: [], total: 0 });
  });

  it('BU03: se combina con los filtros de categoría y de subcategoría', async () => {
    await crear(agente, ropa, 'Blusa floral');
    await crear(agente, bolsos, 'Bolso floral');
    const soloRopa = await agente.get(
      `/api/v1/productos?q=floral&categoriaId=${ropa.categoria.id}`,
    );
    expect(nombres(soloRopa)).toEqual(['Blusa floral']);
    const soloCarteras = await agente.get(
      `/api/v1/productos?q=floral&subcategoriaId=${bolsos.subcategoria.id}`,
    );
    expect(nombres(soloCarteras)).toEqual(['Bolso floral']);
  });

  it('BU04: conserva el comportamiento de los desactivados: por defecto no salen, con estado=inactivos sí', async () => {
    const id = await crear(agente, ropa, 'Blusa vieja', 0);
    await crear(agente, ropa, 'Blusa nueva');
    await agente.delete(`/api/v1/productos/${id}`);
    expect(nombres(await agente.get('/api/v1/productos?q=blusa'))).toEqual(['Blusa nueva']);
    expect(nombres(await agente.get('/api/v1/productos?q=blusa&estado=inactivos'))).toEqual([
      'Blusa vieja',
    ]);
    expect(nombres(await agente.get('/api/v1/productos?q=blusa&estado=todos'))).toHaveLength(2);
    const bajo = await agente.get('/api/v1/productos?q=blusa&estado=activos');
    expect(bajo.body.stockBajo).toBe(0);
  });

  it('BU05: con más de 100 productos sigue exacto: encuentra uno fuera de la primera página y pagina los resultados', async () => {
    const subcategoriaId = ropa.subcategoria.id;
    const usuarioId = (
      await prisma.subcategoria.findUniqueOrThrow({ where: { id: subcategoriaId } })
    ).usuarioId;
    await prisma.producto.createMany({
      data: Array.from({ length: 130 }, (_, i) => ({
        usuarioId,
        subcategoriaId,
        nombre: i === 125 ? 'Pañuelo único' : `Producto ${i}`,
        stock: 4,
      })),
    });
    const unico = await agente.get('/api/v1/productos?q=panuelo&limit=100');
    expect(nombres(unico)).toEqual(['Pañuelo único']);
    const todos = await agente.get('/api/v1/productos?q=producto&limit=100');
    expect(todos.body.total).toBe(129);
    expect(todos.body.datos).toHaveLength(100);
    const segunda = await agente.get('/api/v1/productos?q=producto&limit=100&page=2');
    expect(segunda.body.datos).toHaveLength(29);
    const sinBusqueda = await agente.get('/api/v1/productos?limit=100&page=2');
    expect(sinBusqueda.body).toMatchObject({ total: 130 });
    expect(sinBusqueda.body.datos).toHaveLength(30);
  });

  it('BU06: no devuelve productos de otro usuario aunque coincidan', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    await crear(otro, ajeno, 'Blusa ajena');
    await crear(agente, ropa, 'Blusa propia');
    expect(nombres(await agente.get('/api/v1/productos?q=blusa'))).toEqual(['Blusa propia']);
  });

  it('BU07: rechaza parámetros desconocidos y sin sesión responde 401', async () => {
    expect((await agente.get('/api/v1/productos?q=a&usuarioId=1')).status).toBe(422);
    expect((await request(app).get('/api/v1/productos?q=a')).status).toBe(401);
  });
});

describe('GET /api/v1/categorias?q= y /subcategorias?q=', () => {
  it('BU08: una categoría aparece si coincide su nombre o el de una de sus subcategorías', async () => {
    const res = await agente.get('/api/v1/categorias?q=cartera');
    expect(res.body.map((c: { nombre: string }) => c.nombre)).toEqual(['Bolsos']);
    const porNombre = await agente.get('/api/v1/categorias?q=ROPA');
    expect(porNombre.body.map((c: { nombre: string }) => c.nombre)).toEqual(['Ropa']);
    expect((await agente.get('/api/v1/categorias?q=zzz')).body).toEqual([]);
    expect((await agente.get('/api/v1/categorias')).body).toHaveLength(2);
  });

  it('BU09: la búsqueda de categorías conserva el filtro de estado y ve las subcategorías desactivadas', async () => {
    const res = await agente.get('/api/v1/categorias?q=blusas&estado=inactivos');
    expect(res.body).toEqual([]);
    await agente
      .post('/api/v1/subcategorias')
      .send({ categoriaId: ropa.categoria.id, nombre: 'Pantalones' });
    expect((await agente.get('/api/v1/categorias?q=pantalón')).body).toHaveLength(1);
  });

  it('BU10: las subcategorías se buscan por su nombre y por el de su categoría', async () => {
    const porNombre = await agente.get('/api/v1/subcategorias?q=CARTERAS');
    expect(porNombre.body.map((s: { nombre: string }) => s.nombre)).toEqual(['Carteras']);
    const porCategoria = await agente.get('/api/v1/subcategorias?q=ropa');
    expect(porCategoria.body.map((s: { nombre: string }) => s.nombre)).toEqual(['Blusas']);
    const combinado = await agente.get(
      `/api/v1/subcategorias?q=bolsos&categoriaId=${ropa.categoria.id}`,
    );
    expect(combinado.body).toEqual([]);
  });

  it('BU11: no filtran datos de otro usuario y rechazan parámetros desconocidos', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    await crearCatalogoDePrueba(otro, 'Zapatos', 'Tacones', 'sneaker');
    expect((await agente.get('/api/v1/categorias?q=zapatos')).body).toEqual([]);
    expect((await agente.get('/api/v1/subcategorias?q=tacones')).body).toEqual([]);
    expect((await agente.get('/api/v1/categorias?q=a&x=1')).status).toBe(422);
    expect((await agente.get('/api/v1/subcategorias?q=a&x=1')).status).toBe(422);
  });
});

describe('GET /api/v1/ventas/semana (gráfica del Inicio)', () => {
  const vender = (productoId: number, cantidad: number, fecha: Date) =>
    prisma.venta.create({ data: { productoId, cantidad, fecha } });

  it('VS01: devuelve los 7 días de la semana en curso, de lunes a domingo, con ceros, sin hora', async () => {
    const res = await agente.get('/api/v1/ventas/semana');
    expect(res.status).toBe(200);
    expect(res.body.dias).toHaveLength(7);
    expect(res.body.dias.every((d: { cantidad: number }) => d.cantidad === 0)).toBe(true);
    expect(res.body).toMatchObject({ total: 0, diaMayor: null });
    const [lunes, domingo] = [res.body.dias[0], res.body.dias[6]];
    expect(new Date(`${lunes.fecha}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(new Date(`${domingo.fecha}T00:00:00Z`).getUTCDay()).toBe(0);
    for (const d of res.body.dias) expect(d.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.dias.filter((d: { esHoy: boolean }) => d.esHoy)).toHaveLength(1);
  });

  it('VS02: suma las ventas por día de la semana en curso y excluye otras semanas', async () => {
    const id = await crear(agente, ropa, 'Blusa floral');
    const ahora = new Date();
    const semana = semanaDe(ahora, ZONA);
    const lunes10 = new Date(semana.inicio.getTime() + 10 * 3_600_000);
    const martes = new Date(semana.inicio.getTime() + 86_400_000 + 20 * 3_600_000);
    await vender(id, 2, lunes10);
    await vender(id, 3, new Date(lunes10.getTime() + 3_600_000));
    await vender(id, 4, martes);
    await vender(id, 50, new Date(semana.inicio.getTime() - 1));
    await vender(id, 60, semana.fin);
    const res = await agente.get('/api/v1/ventas/semana');
    const cantidades = res.body.dias.map((d: { cantidad: number }) => d.cantidad);
    expect(cantidades.slice(0, 3)).toEqual([5, 4, 0]);
    expect(res.body.total).toBe(9);
    expect(res.body.diaMayor.fecha).toBe(res.body.dias[0].fecha);
    expect(res.body.dias[0].fecha).toBe(diaLocal(semana.inicio, ZONA));
  });

  it('VS03: las ventas de productos desactivados no cuentan', async () => {
    const activo = await crear(agente, ropa, 'Blusa floral');
    const inactivo = await crear(agente, ropa, 'Blusa vieja');
    const semana = semanaDe(new Date(), ZONA);
    const momento = new Date(semana.inicio.getTime() + 12 * 3_600_000);
    await vender(activo, 3, momento);
    await vender(inactivo, 40, momento);
    await agente.delete(`/api/v1/productos/${inactivo}`);
    const res = await agente.get('/api/v1/ventas/semana');
    expect(res.body.total).toBe(3);
  });

  it('VS04: aislamiento: no suma ventas de productos de otro usuario', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const idAjeno = await crear(otro, ajeno, 'Blusa ajena');
    const semana = semanaDe(new Date(), ZONA);
    await vender(idAjeno, 99, new Date(semana.inicio.getTime() + 12 * 3_600_000));
    const res = await agente.get('/api/v1/ventas/semana');
    expect(res.body.total).toBe(0);
    const propio = await prisma.usuario.findFirstOrThrow({
      where: { correo: 'prueba@ejemplo.com' },
    });
    expect((await ventasService.semana(propio.id)).total).toBe(0);
  });

  it('VS05: sin sesión responde 401 y rechaza parámetros desconocidos', async () => {
    expect((await request(app).get('/api/v1/ventas/semana')).status).toBe(401);
    expect((await agente.get('/api/v1/ventas/semana?usuarioId=1')).status).toBe(422);
  });

  it('VS06: una venta del domingo 23:59 y otra del lunes 00:00 de Guatemala caen en semanas distintas', async () => {
    const id = await crear(agente, ropa, 'Blusa floral');
    const semana = semanaDe(new Date(), ZONA);
    await vender(id, 2, new Date(semana.fin.getTime() - 1));
    await vender(id, 5, semana.inicio);
    const res = await agente.get('/api/v1/ventas/semana');
    expect(res.body.dias[6].cantidad).toBe(2);
    expect(res.body.dias[0].cantidad).toBe(5);
  });
});
