import { readFileSync, writeFileSync } from 'node:fs';
import { calcularPts } from '../../backend/src/modules/prediccion/pts.ts';
import { semanaDe } from '../../backend/src/shared/time/semana.ts';

interface Fila {
  producto: string;
  semana: string;
  real: number;
  ptsSugerido: number;
  ojoSugerido: number;
  historial: [number, number, number];
}

interface Metricas {
  semanasEvaluadas: number;
  semanasCubiertas: number;
  porcentajeCubierto: number;
  unidadesFaltantes: number;
  unidadesSobrantes: number;
  unidadesCompradas: number;
  unidadesVendidas: number;
}

const DIA_MS = 86_400_000;
const ZONA = process.env['TIMEZONE'] ?? 'America/Guatemala';

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function lunes(texto: string): string {
  const fecha = new Date(`${texto.trim().slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) throw new Error(`Semana inválida: "${texto}"`);
  const dia = fecha.getUTCDay();
  const atras = dia === 0 ? 6 : dia - 1;
  return new Date(fecha.getTime() - atras * DIA_MS).toISOString().slice(0, 10);
}

function sumarSemanas(semana: string, n: number): string {
  return new Date(new Date(`${semana}T12:00:00Z`).getTime() + n * 7 * DIA_MS)
    .toISOString()
    .slice(0, 10);
}

function dividirCsv(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let comillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const c = linea[i]!;
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else if (c === '"') comillas = false;
      else actual += c;
    } else if (c === '"') comillas = true;
    else if (c === ',' || c === ';') {
      campos.push(actual);
      actual = '';
    } else actual += c;
  }
  campos.push(actual);
  return campos.map((x) => x.trim());
}

type Historiales = Map<string, Map<string, number>>;

function leerCsv(ruta: string): Historiales {
  const texto = readFileSync(ruta, 'utf8').split(String.fromCharCode(0xfeff)).join('');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const cabecera = dividirCsv(lineas[0] ?? '').map((x) => x.toLowerCase());
  const iProducto = cabecera.indexOf('producto');
  const iSemana = cabecera.indexOf('semana');
  const iUnidades = cabecera.indexOf('unidades');
  if (iProducto < 0 || iSemana < 0 || iUnidades < 0) {
    throw new Error('El CSV debe tener las columnas: producto, semana, unidades');
  }
  const datos: Historiales = new Map();
  for (const linea of lineas.slice(1)) {
    const c = dividirCsv(linea);
    const unidades = Number(c[iUnidades]);
    if (!Number.isInteger(unidades) || unidades < 0) {
      throw new Error(`Unidades inválidas en la línea: ${linea}`);
    }
    const producto = c[iProducto] ?? '';
    const semana = lunes(c[iSemana] ?? '');
    const porSemana = datos.get(producto) ?? new Map<string, number>();
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + unidades);
    datos.set(producto, porSemana);
  }
  return datos;
}

async function leerBase(): Promise<{ datos: Historiales; excluidos: string[] }> {
  const { prisma } = await import('../../backend/src/shared/db/prisma.ts');
  const correo = argumento('--correo') ?? 'demo@stockpredict.local';
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) throw new Error(`No existe el usuario ${correo}. Corre npm run db:seed`);
  const productos = await prisma.producto.findMany({
    where: { usuarioId: usuario.id },
    select: { id: true, nombre: true, estado: true },
  });
  const ahora = new Date();
  const enCurso = semanaDe(ahora, ZONA).inicio.getTime();
  const datos: Historiales = new Map();
  const excluidos: string[] = [];
  for (const p of productos) {
    if (!p.estado) {
      excluidos.push(`${p.nombre} (desactivado: la predicción real no lo calcula)`);
      continue;
    }
    const ventas = await prisma.venta.findMany({
      where: { productoId: p.id },
      select: { cantidad: true, fecha: true },
    });
    const porSemana = new Map<string, number>();
    for (const v of ventas) {
      const inicio = semanaDe(v.fecha, ZONA).inicio;
      if (inicio.getTime() >= enCurso) continue;
      const clave = new Date(inicio.getTime() + 12 * 3_600_000).toISOString().slice(0, 10);
      porSemana.set(lunes(clave), (porSemana.get(lunes(clave)) ?? 0) + v.cantidad);
    }
    if (porSemana.size === 0) {
      excluidos.push(`${p.nombre} (producto nuevo, sin semanas cerradas con ventas)`);
      continue;
    }
    datos.set(p.nombre, porSemana);
  }
  await prisma.$disconnect();
  return { datos, excluidos };
}

function evaluar(datos: Historiales): Fila[] {
  const filas: Fila[] = [];
  for (const [producto, porSemana] of datos) {
    const semanas = [...porSemana.keys()].sort();
    const primera = semanas[0]!;
    const ultima = semanas[semanas.length - 1]!;
    const ventas = (s: string) => porSemana.get(s) ?? 0;
    for (let s = sumarSemanas(primera, 3); s <= ultima; s = sumarSemanas(s, 1)) {
      const v1 = ventas(sumarSemanas(s, -1));
      const v2 = ventas(sumarSemanas(s, -2));
      const v3 = ventas(sumarSemanas(s, -3));
      filas.push({
        producto,
        semana: s,
        real: ventas(s),
        ptsSugerido: calcularPts({ v1, v2, v3 }).stockSugerido,
        ojoSugerido: v1,
        historial: [v1, v2, v3],
      });
    }
  }
  return filas.sort(
    (a, b) => a.semana.localeCompare(b.semana) || a.producto.localeCompare(b.producto),
  );
}

function metricas(filas: Fila[], campo: 'ptsSugerido' | 'ojoSugerido'): Metricas {
  let cubiertas = 0;
  let faltantes = 0;
  let sobrantes = 0;
  let compradas = 0;
  let vendidas = 0;
  for (const f of filas) {
    const stock = f[campo];
    if (stock >= f.real) cubiertas += 1;
    faltantes += Math.max(f.real - stock, 0);
    sobrantes += Math.max(stock - f.real, 0);
    compradas += stock;
    vendidas += f.real;
  }
  return {
    semanasEvaluadas: filas.length,
    semanasCubiertas: cubiertas,
    porcentajeCubierto: filas.length === 0 ? 0 : Math.round((1000 * cubiertas) / filas.length) / 10,
    unidadesFaltantes: faltantes,
    unidadesSobrantes: sobrantes,
    unidadesCompradas: compradas,
    unidadesVendidas: vendidas,
  };
}

const rutaCsv = argumento('--csv');
const salida = argumento('--salida') ?? 'docs/evidencias/datos/retrospectiva.json';
const { datos, excluidos } = rutaCsv
  ? { datos: leerCsv(rutaCsv), excluidos: [] as string[] }
  : await leerBase();

const filas = evaluar(datos);
const semanasPorProducto = [...datos.values()].map((m) => m.size);
const resultado = {
  generado: new Date().toISOString(),
  origen: rutaCsv ? 'csv' : 'base-demo',
  esDemostracion: !rutaCsv,
  archivo: rutaCsv ?? null,
  productos: datos.size,
  excluidos,
  semanasConHistorialPorProducto: {
    minimo: Math.min(...semanasPorProducto),
    maximo: Math.max(...semanasPorProducto),
  },
  supuestos: [
    'Para cada producto y semana con 3 semanas previas se compra exactamente lo que sugiere el método, sin contar stock que ya hubiera.',
    'El stock "alcanzó" cuando lo comprado es mayor o igual a lo vendido esa semana.',
    'Faltaron = unidades vendidas que no alcanzaron a cubrirse. Sobraron = unidades compradas que no se vendieron.',
    'PTS usa la función real calcularPts del sistema (V1, V2 y V3 de las 3 semanas previas, margen 20 %, sin tope de tendencia).',
    'El método "a ojo" repite lo vendido la semana anterior.',
    'El historial de un producto empieza en su primera semana con ventas; las semanas intermedias sin ventas cuentan como 0.',
    'No se ajustó la fórmula ni los datos.',
  ],
  pts: metricas(filas, 'ptsSugerido'),
  ojo: metricas(filas, 'ojoSugerido'),
  filas,
};
writeFileSync(salida, JSON.stringify(resultado, null, 2));
console.log(
  `Retrospectiva (${resultado.origen}): ${filas.length} producto-semana. PTS cubre ${resultado.pts.porcentajeCubierto} %, a ojo ${resultado.ojo.porcentajeCubierto} %. Guardado en ${salida}`,
);
