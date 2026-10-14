import bcrypt from 'bcrypt';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/db/prisma.js';
import { semanaDe, semanasCerradas } from '../src/shared/time/semana.js';

export const CORREO_DEMO = 'demo@stockpredict.local';
export const CONTRASENA_DEMO = 'Demo1234!';

interface ProductoSemilla {
  nombre: string;
  categoria: string;
  subcategoria: string;
  descripcion?: string;
  stock: number;
  ventas: [number, number, number];
  nuevo?: boolean;
  inactivo?: boolean;
}

interface SubcategoriaSemilla {
  categoria: string;
  nombre: string;
  icono?: string;
}

const CATEGORIAS = [
  { nombre: 'Ropa', icono: 't-shirt' },
  { nombre: 'Maquillaje', icono: 'paint-brush' },
  { nombre: 'Bolsos', icono: 'handbag-simple' },
  { nombre: 'Perfumes', icono: 'flask' },
  { nombre: 'Accesorios', icono: 'sunglasses' },
  { nombre: 'Calzado', icono: 'sneaker' },
];

const SUBCATEGORIAS: SubcategoriaSemilla[] = [
  { categoria: 'Ropa', nombre: 'Blusas' },
  { categoria: 'Ropa', nombre: 'Pantalones' },
  { categoria: 'Ropa', nombre: 'Vestidos', icono: 'dress' },
  { categoria: 'Ropa', nombre: 'Abrigos' },
  { categoria: 'Maquillaje', nombre: 'Labiales' },
  { categoria: 'Maquillaje', nombre: 'Bases' },
  { categoria: 'Bolsos', nombre: 'Totes' },
  { categoria: 'Bolsos', nombre: 'Crossbody' },
  { categoria: 'Perfumes', nombre: 'Dama', icono: 'heart' },
  { categoria: 'Perfumes', nombre: 'Caballero' },
  { categoria: 'Accesorios', nombre: 'Collares', icono: 'diamond' },
  { categoria: 'Accesorios', nombre: 'Aretes' },
  { categoria: 'Accesorios', nombre: 'Cinturones' },
  { categoria: 'Accesorios', nombre: 'Pulseras', icono: 'gift' },
  { categoria: 'Calzado', nombre: 'Sandalias' },
];

// ventas = [V3, V2, V1] (V1 = semana cerrada más reciente)
const PRODUCTOS: ProductoSemilla[] = [
  {
    nombre: 'Blusa floral',
    categoria: 'Ropa',
    subcategoria: 'Blusas',
    descripcion: 'Blusa de algodón con estampado floral y manga corta. Tallas S, M y L.',
    stock: 3,
    ventas: [5, 6, 8],
  },
  {
    nombre: 'Vestido casual midi',
    categoria: 'Ropa',
    subcategoria: 'Vestidos',
    stock: 15,
    ventas: [4, 5, 6],
  },
  {
    nombre: 'Blusa de lino',
    categoria: 'Ropa',
    subcategoria: 'Blusas',
    descripcion: 'Blusa fresca de lino, color crema.',
    stock: 4,
    ventas: [0, 0, 0],
    nuevo: true,
  },
  {
    nombre: 'Labial mate rojo cereza',
    categoria: 'Maquillaje',
    subcategoria: 'Labiales',
    stock: 3,
    ventas: [15, 12, 10],
  },
  {
    nombre: 'Base líquida cobertura media',
    categoria: 'Maquillaje',
    subcategoria: 'Bases',
    stock: 20,
    ventas: [3, 4, 5],
  },
  {
    nombre: 'Bolso tote de piel negro',
    categoria: 'Bolsos',
    subcategoria: 'Totes',
    stock: 2,
    ventas: [6, 5, 4],
  },
  {
    nombre: 'Bolso crossbody mini',
    categoria: 'Bolsos',
    subcategoria: 'Crossbody',
    stock: 10,
    ventas: [3, 2, 2],
  },
  {
    nombre: 'Perfume floral 50ml',
    categoria: 'Perfumes',
    subcategoria: 'Dama',
    stock: 5,
    ventas: [9, 7, 6],
  },
  {
    nombre: 'Perfume amaderado 100ml',
    categoria: 'Perfumes',
    subcategoria: 'Caballero',
    stock: 12,
    ventas: [2, 2, 3],
  },
  {
    nombre: 'Collar dorado charm',
    categoria: 'Accesorios',
    subcategoria: 'Collares',
    stock: 1,
    ventas: [3, 0, 5],
  },
  {
    nombre: 'Aretes de perla',
    categoria: 'Accesorios',
    subcategoria: 'Aretes',
    stock: 25,
    ventas: [1, 1, 2],
  },
  {
    nombre: 'Cinturón de cuero café',
    categoria: 'Accesorios',
    subcategoria: 'Cinturones',
    stock: 1,
    ventas: [5, 4, 3],
  },
  {
    nombre: 'Pulsera set 3 piezas',
    categoria: 'Accesorios',
    subcategoria: 'Pulseras',
    stock: 18,
    ventas: [2, 3, 3],
  },
  {
    nombre: 'Chaleco de lana (descontinuado)',
    categoria: 'Ropa',
    subcategoria: 'Abrigos',
    stock: 0,
    ventas: [20, 20, 20],
    inactivo: true,
  },
  {
    nombre: 'Sandalia dorada',
    categoria: 'Calzado',
    subcategoria: 'Sandalias',
    stock: 6,
    ventas: [0, 0, 0],
    nuevo: true,
  },
];

const DIA_MS = 86_400_000;
const HORA_VENTA_MS = 21 * 3_600_000;

function repartir(total: number, inicio: Date, dias: number): { fecha: Date; cantidad: number }[] {
  const filas: { fecha: Date; cantidad: number }[] = [];
  let restante = total;
  let k = 0;
  while (restante > 0) {
    const cantidad = Math.min(restante, (k % 3) + 1);
    const dia = (k * 2 + 1) % dias;
    filas.push({ fecha: new Date(inicio.getTime() + dia * DIA_MS + HORA_VENTA_MS), cantidad });
    restante -= cantidad;
    k += 1;
  }
  return filas;
}

export async function borrarUsuarioDemo() {
  const existente = await prisma.usuario.findUnique({ where: { correo: CORREO_DEMO } });
  if (!existente) return;
  const ids = (
    await prisma.producto.findMany({ where: { usuarioId: existente.id }, select: { id: true } })
  ).map((p) => p.id);
  await prisma.venta.deleteMany({ where: { productoId: { in: ids } } });
  await prisma.movimientoInventario.deleteMany({ where: { productoId: { in: ids } } });
  await prisma.producto.deleteMany({ where: { usuarioId: existente.id } });
  await prisma.subcategoria.deleteMany({ where: { usuarioId: existente.id } });
  await prisma.categoria.deleteMany({ where: { usuarioId: existente.id } });
  await prisma.usuario.delete({ where: { id: existente.id } });
}

export async function sembrarDemo(ahora: Date = new Date()) {
  if (env.NODE_ENV === 'production') {
    throw new Error('El seed no se ejecuta en producción');
  }
  await borrarUsuarioDemo();

  const cerradas = semanasCerradas(ahora, env.TIMEZONE, 4);
  const enCurso = semanaDe(ahora, env.TIMEZONE);
  const hace5Semanas = new Date(enCurso.inicio.getTime() - 35 * DIA_MS);

  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Valesca',
      correo: CORREO_DEMO,
      contrasenaHash: await bcrypt.hash(CONTRASENA_DEMO, env.BCRYPT_COST),
      fechaCreacion: hace5Semanas,
    },
  });

  const categorias = new Map<string, number>();
  for (const c of CATEGORIAS) {
    const creada = await prisma.categoria.create({
      data: { ...c, usuarioId: usuario.id, creadoEn: hace5Semanas },
    });
    categorias.set(c.nombre, creada.id);
  }

  const subcategorias = new Map<string, number>();
  for (const sub of SUBCATEGORIAS) {
    const categoriaId = categorias.get(sub.categoria);
    if (categoriaId === undefined) throw new Error(`Categoría ${sub.categoria} no existe`);
    const creada = await prisma.subcategoria.create({
      data: {
        usuarioId: usuario.id,
        categoriaId,
        nombre: sub.nombre,
        icono: sub.icono ?? null,
        creadoEn: hace5Semanas,
      },
    });
    subcategorias.set(`${sub.categoria}/${sub.nombre}`, creada.id);
  }

  const diasTranscurridos = Math.max(
    1,
    Math.min(7, Math.floor((ahora.getTime() - enCurso.inicio.getTime()) / DIA_MS) + 1),
  );

  for (const p of PRODUCTOS) {
    const subcategoriaId = subcategorias.get(`${p.categoria}/${p.subcategoria}`);
    if (subcategoriaId === undefined) {
      throw new Error(`Subcategoría ${p.categoria}/${p.subcategoria} no existe`);
    }
    const producto = await prisma.producto.create({
      data: {
        nombre: p.nombre,
        subcategoriaId,
        descripcion: p.descripcion ?? null,
        usuarioId: usuario.id,
        stock: p.stock,
        estado: !p.inactivo,
        creadoEn: p.nuevo ? ahora : hace5Semanas,
      },
    });
    if (p.nuevo) continue;

    const [v3, v2, v1] = p.ventas;
    const porSemana: [number, number][] = [
      [0, v1],
      [1, v2],
      [2, v3],
      [3, Math.max(1, v3 - 1)],
    ];
    const filas: { productoId: number; cantidad: number; fecha: Date }[] = [];
    for (const [indice, total] of porSemana) {
      const semana = cerradas[indice];
      if (!semana) continue;
      for (const f of repartir(total, semana.inicio, 7)) {
        filas.push({ productoId: producto.id, ...f });
      }
    }
    for (const f of repartir(Math.max(1, Math.round(v1 / 2)), enCurso.inicio, diasTranscurridos)) {
      filas.push({ productoId: producto.id, ...f });
    }
    await prisma.venta.createMany({ data: filas });
  }

  return { usuarioId: usuario.id, correo: CORREO_DEMO, contrasena: CONTRASENA_DEMO };
}
