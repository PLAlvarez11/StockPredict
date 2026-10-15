import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { semanasCerradas } from '../../shared/time/semana.js';
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
let blusas: Catalogo;
let vestidos: Catalogo;
let totes: Catalogo;

const crearProducto = async (
  catalogo: Catalogo,
  nombre: string,
  stock: number,
  ventas?: [number, number, number],
) => {
  const res = await agente
    .post('/api/v1/productos')
    .send({ nombre, subcategoriaId: catalogo.subcategoria.id, stockInicial: stock });
  expect(res.status).toBe(201);
  const id = res.body.id as number;
  if (ventas) {
    const [reciente, media, antigua] = semanasCerradas(new Date(), ZONA, 3);
    if (!reciente || !media || !antigua) throw new Error('Faltan semanas');
    const medio = (s: { inicio: Date; fin: Date }) =>
      new Date((s.inicio.getTime() + s.fin.getTime()) / 2);
    await prisma.producto.update({
      where: { id },
      data: { creadoEn: new Date(antigua.inicio.getTime() - 86_400_000) },
    });
    await prisma.venta.createMany({
      data: [
        { productoId: id, cantidad: ventas[0], fecha: medio(reciente) },
        { productoId: id, cantidad: ventas[1], fecha: medio(media) },
        { productoId: id, cantidad: ventas[2], fecha: medio(antigua) },
      ],
    });
  }
  return id;
};

const prediccion = (consulta = '') => agente.get(`/api/v1/prediccion${consulta}`);
const nombres = (res: request.Response) =>
  (res.body.items as { producto: { nombre: string } }[]).map((i) => i.producto.nombre);
interface ItemApi {
  producto: { nombre: string };
  origen: string | null;
  estado: string;
  stockSugerido: number | null;
}
const item = (res: request.Response, nombre: string) =>
  (res.body.items as ItemApi[]).find((i) => i.producto.nombre === nombre);

beforeEach(async () => {
  await limpiarBase();
  agente = await iniciarSesionDePrueba(app);
  blusas = await crearCatalogoDePrueba(agente, 'Ropa', 'Blusas', 't-shirt');
  const sub = await agente
    .post('/api/v1/subcategorias')
    .send({ categoriaId: blusas.categoria.id, nombre: 'Vestidos' });
  vestidos = { categoria: blusas.categoria, subcategoria: sub.body };
  totes = await crearCatalogoDePrueba(agente, 'Bolsos', 'Totes', 'handbag-simple');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('predicción: origen del cálculo y margen', () => {
  it('PR09: con historial propio usa el margen de 20 %: Blusa floral da sugerido 10 y comprar 7', async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    const res = await prediccion();
    expect(item(res, 'Blusa floral')).toMatchObject({
      origen: 'producto',
      stockSugerido: 10,
      cantidadAComprar: 7,
      necesidadPct: 70,
      semaforo: 'rojo',
      calculo: { margenPorCiento: 20 },
    });
  });

  it('PR10: un producto nuevo usa primero la subcategoría y el margen baja a 10 %', async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(blusas, 'Blusa de lino', 4);
    const lino = item(await prediccion(), 'Blusa de lino');
    expect(lino).toMatchObject({
      origen: 'subcategoria',
      stockSugerido: 9,
      cantidadAComprar: 5,
      calculo: { margenPorCiento: 10, margen: 0.1, productosBase: 1 },
    });
  });

  it('PR11: sin datos en la subcategoría usa la categoría completa, con margen de 10 %', async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(vestidos, 'Vestido midi', 3, [6, 5, 4]);
    await crearProducto(await crearCatalogoSub('Faldas'), 'Falda larga', 2);
    const falda = item(await prediccion(), 'Falda larga');
    expect(falda).toMatchObject({
      origen: 'categoria',
      stockSugerido: 8,
      calculo: { margenPorCiento: 10, productosBase: 2 },
    });
  });

  it('PR12: sin datos en la subcategoría ni en la categoría dice "sin historial suficiente"', async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(totes, 'Tote lona', 5);
    const tote = item(await prediccion(), 'Tote lona');
    expect(tote).toMatchObject({
      estado: 'sin_historial',
      semaforo: 'neutro',
      origen: null,
      necesidadPct: null,
      stockSugerido: null,
      calculo: null,
    });
  });

  it('PR07: un producto desactivado no aparece ni cuenta en los promedios de respaldo', async () => {
    const floral = await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(blusas, 'Blusa de lino', 4);
    expect(item(await prediccion(), 'Blusa de lino')?.origen).toBe('subcategoria');
    expect((await agente.delete(`/api/v1/productos/${floral}`)).status).toBe(204);
    const res = await prediccion();
    expect(nombres(res)).not.toContain('Blusa floral');
    expect(res.body.totalActivos).toBe(1);
    expect(item(res, 'Blusa de lino')?.estado).toBe('sin_historial');
  });

  it('PR13: la necesidad es compra ÷ sugerido en enteros y el orden va de mayor a menor', async () => {
    await crearProducto(blusas, 'Alta', 1, [8, 6, 5]);
    await crearProducto(blusas, 'Baja', 8, [8, 6, 5]);
    await crearProducto(blusas, 'Sobra', 50, [8, 6, 5]);
    const res = await prediccion();
    expect(nombres(res)).toEqual(['Alta', 'Baja', 'Sobra']);
    expect(res.body.items.map((i: { necesidadPct: number }) => i.necesidadPct)).toEqual([
      90, 20, 0,
    ]);
  });

  async function crearCatalogoSub(nombre: string): Promise<Catalogo> {
    const sub = await agente
      .post('/api/v1/subcategorias')
      .send({ categoriaId: blusas.categoria.id, nombre });
    return { categoria: blusas.categoria, subcategoria: sub.body };
  }
});

describe('GET /api/v1/prediccion con búsqueda y filtros', () => {
  beforeEach(async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(blusas, 'Blusa lila', 7, [8, 6, 5]);
    await crearProducto(vestidos, 'Vestido midi', 40, [6, 5, 4]);
    await crearProducto(totes, 'Tote lona', 5);
  });

  it('PR14: sin filtros devuelve todos los activos, con la semana actual y los totales', async () => {
    const res = await prediccion();
    expect(res.status).toBe(200);
    expect(nombres(res)).toEqual(['Blusa floral', 'Blusa lila', 'Vestido midi', 'Tote lona']);
    expect(res.body).toMatchObject({ totalActivos: 4, totalAComprar: 2, totalFiltrados: 4 });
    expect(res.body.semanaActual.inicio).toBeTypeOf('string');
  });

  it('PR14: el buscador encuentra por nombre, categoría o subcategoría, sin importar acentos ni mayúsculas', async () => {
    expect(nombres(await prediccion('?q=FLORAL'))).toEqual(['Blusa floral']);
    expect(nombres(await prediccion('?q=lila'))).toEqual(['Blusa lila']);
    expect(nombres(await prediccion('?q=bolsos'))).toEqual(['Tote lona']);
    expect(nombres(await prediccion('?q=vestídos'))).toEqual(['Vestido midi']);
    const vacio = await prediccion('?q=zzz');
    expect(vacio.body.items).toEqual([]);
    expect(vacio.body).toMatchObject({ totalActivos: 4, totalFiltrados: 0 });
  });

  it('PR14: filtra por categoría y por subcategoría', async () => {
    expect(nombres(await prediccion(`?categoriaId=${blusas.categoria.id}`))).toEqual([
      'Blusa floral',
      'Blusa lila',
      'Vestido midi',
    ]);
    expect(nombres(await prediccion(`?subcategoriaId=${vestidos.subcategoria.id}`))).toEqual([
      'Vestido midi',
    ]);
  });

  it('PR18: el semáforo va por urgencia: Blusa floral 70 % rojo, Blusa lila 30 % ámbar, Vestido midi verde, Tote lona neutro', async () => {
    const res = await prediccion();
    expect(
      res.body.items.map((i: { semaforo: string; necesidadPct: number | null }) => [
        i.semaforo,
        i.necesidadPct,
      ]),
    ).toEqual([
      ['rojo', 70],
      ['ambar', 30],
      ['verde', 0],
      ['neutro', null],
    ]);
  });

  it('PR18: el filtro por estado usa los mismos colores y conserva el orden', async () => {
    expect(nombres(await prediccion('?estado=rojo'))).toEqual(['Blusa floral']);
    expect(nombres(await prediccion('?estado=ambar'))).toEqual(['Blusa lila']);
    expect(nombres(await prediccion('?estado=verde'))).toEqual(['Vestido midi']);
    expect(nombres(await prediccion('?estado=neutro'))).toEqual(['Tote lona']);
    expect(nombres(await prediccion('?estado=todos'))).toHaveLength(4);
  });

  it('PR14: el filtro conserva el mismo orden relativo que la lista completa', async () => {
    const completa = nombres(await prediccion());
    const parcial = nombres(await prediccion('?estado=todos&q=o'));
    expect(parcial).toEqual(completa.filter((n) => parcial.includes(n)));
  });

  it('PR14: rechaza un estado desconocido y parámetros que no existen', async () => {
    expect((await prediccion('?estado=azul')).status).toBe(422);
    expect((await prediccion('?usuarioId=1')).status).toBe(422);
  });

  it('PR15: no mezcla productos de otro usuario ni deja filtrar por su categoría', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const suyo = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    await otro
      .post('/api/v1/productos')
      .send({ nombre: 'Blusa ajena', subcategoriaId: suyo.subcategoria.id, stockInicial: 1 });
    const mia = await prediccion();
    expect(nombres(mia)).not.toContain('Blusa ajena');
    const cruzado = await prediccion(`?categoriaId=${suyo.categoria.id}`);
    expect(cruzado.body.items).toEqual([]);
    const suya = await otro.get('/api/v1/prediccion');
    expect(nombres(suya)).toEqual(['Blusa ajena']);
  });
});

describe('POST /api/v1/prediccion/simulacion', () => {
  const simular = (cuerpo: object) => agente.post('/api/v1/prediccion/simulacion').send(cuerpo);

  beforeEach(async () => {
    await crearProducto(blusas, 'Blusa floral', 3, [8, 6, 5]);
    await crearProducto(vestidos, 'Vestido midi', 40, [6, 5, 4]);
  });

  it('SM01: sin sesión responde 401', async () => {
    const res = await request(app)
      .post('/api/v1/prediccion/simulacion')
      .send({ categoriaId: blusas.categoria.id });
    expect(res.status).toBe(401);
  });

  it('SM02: con subcategoría calcula como producto nuevo: respaldo por subcategoría con 10 %', async () => {
    const res = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: blusas.subcategoria.id,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'estimado',
      origen: 'subcategoria',
      stockSugerido: 9,
      cantidadAComprar: null,
      calculo: { margenPorCiento: 10, productosBase: 1 },
    });
  });

  it('SM03: sin subcategoría promedia la categoría completa', async () => {
    const res = await simular({ categoriaId: blusas.categoria.id });
    expect(res.body).toMatchObject({
      origen: 'categoria',
      stockSugerido: 8,
      calculo: { productosBase: 2, margenPorCiento: 10 },
    });
  });

  it('SM04: coincide con lo que predice un producto nuevo real en esa subcategoría', async () => {
    const simulado = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: blusas.subcategoria.id,
    });
    await crearProducto(blusas, 'Blusa nueva', 2);
    const real = item(await prediccion(), 'Blusa nueva');
    expect(real?.stockSugerido).toBe(simulado.body.stockSugerido);
  });

  it('SM05: con nombre y stock actual devuelve la compra y la necesidad, y el nombre no cambia el cálculo', async () => {
    const res = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: blusas.subcategoria.id,
      nombre: '  Blusa nueva temporada ',
      stockActual: 4,
    });
    expect(res.body).toMatchObject({
      nombre: 'Blusa nueva temporada',
      stockActual: 4,
      stockSugerido: 9,
      cantidadAComprar: 5,
      necesidadPct: 56,
    });
  });

  it('SM06: sin datos en la categoría responde "sin_historial" sin inventar un valor', async () => {
    const res = await simular({ categoriaId: totes.categoria.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'sin_historial',
      origen: null,
      stockSugerido: null,
      calculo: null,
    });
  });

  it('SM07: no guarda nada: ni productos, ni ventas, ni movimientos', async () => {
    const contar = async () => [
      await prisma.producto.count(),
      await prisma.venta.count(),
      await prisma.movimientoInventario.count(),
    ];
    const antes = await contar();
    await simular({ categoriaId: blusas.categoria.id, nombre: 'Blusa X', stockActual: 1 });
    expect(await contar()).toEqual(antes);
  });

  it('SM08: valida con zod estricto: rechaza campos desconocidos y valores inválidos', async () => {
    const categoriaId = blusas.categoria.id;
    expect((await simular({ categoriaId, usuarioId: 1 })).status).toBe(422);
    expect((await simular({})).status).toBe(422);
    expect((await simular({ categoriaId: 'x' })).status).toBe(422);
    expect((await simular({ categoriaId, stockActual: -1 })).status).toBe(422);
    expect((await simular({ categoriaId, stockActual: 1.5 })).status).toBe(422);
    expect((await simular({ categoriaId, nombre: 'a'.repeat(151) })).status).toBe(422);
  });

  it('SM09: una categoría o subcategoría de otro usuario, inactiva o de otra categoría se rechaza', async () => {
    const otro = await iniciarSesionDePrueba(app, 'otro@ejemplo.com');
    const ajeno = await crearCatalogoDePrueba(otro, 'Ropa', 'Blusas', 't-shirt');
    const categoriaAjena = await simular({ categoriaId: ajeno.categoria.id });
    expect(categoriaAjena.status).toBe(422);
    expect(categoriaAjena.body.errors[0].field).toBe('categoriaId');
    const subAjena = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: ajeno.subcategoria.id,
    });
    expect(subAjena.status).toBe(422);
    expect(subAjena.body.errors[0].field).toBe('subcategoriaId');
    const cruzada = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: totes.subcategoria.id,
    });
    expect(cruzada.status).toBe(422);
    const vestido = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Vestido midi' } });
    await agente.delete(`/api/v1/productos/${vestido.id}`);
    await agente.delete(`/api/v1/subcategorias/${vestidos.subcategoria.id}`);
    const inactiva = await simular({
      categoriaId: blusas.categoria.id,
      subcategoriaId: vestidos.subcategoria.id,
    });
    expect(inactiva.status).toBe(422);
  });

  it('SM10: los productos desactivados no cuentan en el respaldo del simulador', async () => {
    const vestido = await prisma.producto.findFirstOrThrow({ where: { nombre: 'Vestido midi' } });
    await agente.delete(`/api/v1/productos/${vestido.id}`);
    const res = await simular({ categoriaId: blusas.categoria.id });
    expect(res.body.calculo.productosBase).toBe(1);
  });
});
