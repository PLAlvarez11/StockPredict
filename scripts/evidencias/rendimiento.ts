import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import {
  DATOS,
  RAIZ,
  URL_DEMO,
  URL_PRUEBAS,
  ejecutar,
  iniciarBackend,
  pausa,
  recortar,
} from './servidores.ts';

const SOLICITUDES = 300;
const ENTRADA_DEMO = { correo: 'demo@stockpredict.local', contrasena: 'Demo1234!' };
const ENTRADA_CARGA = { correo: 'carga@evidencias.local', contrasena: 'Carga1234!' };

async function sesion(puerto: number, entrada: { correo: string; contrasena: string }) {
  const r = await fetch(`http://127.0.0.1:${puerto}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify(entrada),
  });
  if (r.status !== 200) throw new Error(`Login fallido (${r.status})`);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function medirPrediccion(puerto: number, cookie: string) {
  const url = `http://127.0.0.1:${puerto}/api/v1/prediccion`;
  for (let i = 0; i < 10; i += 1) await fetch(url, { headers: { Cookie: cookie } });
  const tiempos: number[] = [];
  let bytes = 0;
  let productos = 0;
  for (let i = 0; i < SOLICITUDES; i += 1) {
    const t = performance.now();
    const r = await fetch(url, { headers: { Cookie: cookie } });
    const cuerpo = await r.text();
    tiempos.push(performance.now() - t);
    if (r.status !== 200) throw new Error(`GET /prediccion respondió ${r.status}`);
    bytes = cuerpo.length;
    productos = (JSON.parse(cuerpo) as { items: unknown[] }).items.length;
  }
  const suma = tiempos.reduce((a, b) => a + b, 0);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    solicitudes: SOLICITUDES,
    productosEnLaRespuesta: productos,
    bytesRespuesta: bytes,
    medianaMs: r1(recortar(tiempos, 0.5)),
    p95Ms: r1(recortar(tiempos, 0.95)),
    p99Ms: r1(recortar(tiempos, 0.99)),
    maximoMs: r1(Math.max(...tiempos)),
    promedioMs: r1(suma / tiempos.length),
  };
}

async function sembrarCarga(productos: number) {
  process.env['DATABASE_URL'] = URL_PRUEBAS;
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['JWT_SECRET'] ??= 'secreto-de-evidencias-con-mas-de-treinta-y-dos-caracteres';
  const { prisma } = await import('../../backend/src/shared/db/prisma.ts');
  const { semanasCerradas } = await import('../../backend/src/shared/time/semana.ts');
  const bcrypt = (await import('bcrypt')) as unknown as {
    default: { hash: (a: string, b: number) => Promise<string> };
  };
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE usuario, categoria, subcategoria, producto, venta, movimiento_inventario, token_recuperacion RESTART IDENTITY CASCADE',
  );
  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Carga',
      correo: ENTRADA_CARGA.correo,
      contrasenaHash: await bcrypt.default.hash(ENTRADA_CARGA.contrasena, 4),
    },
  });
  const categoria = await prisma.categoria.create({
    data: { usuarioId: usuario.id, nombre: 'Ropa', icono: 't-shirt' },
  });
  const sub = await prisma.subcategoria.create({
    data: { usuarioId: usuario.id, categoriaId: categoria.id, nombre: 'Blusas' },
  });
  const semanas = semanasCerradas(new Date(), 'America/Guatemala', 3);
  const viejo = new Date(semanas[2]!.inicio.getTime() - 86_400_000);
  const ventas: { productoId: number; cantidad: number; fecha: Date }[] = [];
  for (let i = 0; i < productos; i += 1) {
    const p = await prisma.producto.create({
      data: {
        usuarioId: usuario.id,
        subcategoriaId: sub.id,
        nombre: `Producto de carga ${i}`,
        stock: i % 9,
        creadoEn: i % 10 === 0 ? new Date() : viejo,
      },
    });
    for (const s of semanas) {
      for (let k = 0; k < 8; k += 1) {
        ventas.push({
          productoId: p.id,
          cantidad: 1 + ((i + k) % 5),
          fecha: new Date(s.inicio.getTime() + (k + 1) * 3_600_000 * 12),
        });
      }
    }
  }
  await prisma.venta.createMany({ data: ventas });
  await prisma.$disconnect();
  return { productos, ventas: ventas.length };
}

const demoServidor = await iniciarBackend(3100, URL_DEMO);
const cookieDemo = await sesion(3100, ENTRADA_DEMO);
const demo = await medirPrediccion(3100, cookieDemo);
demoServidor.kill();
console.log('Demo:', demo);

const carga = await sembrarCarga(200);
const cargaServidor = await iniciarBackend(3101, URL_PRUEBAS);
const cookieCarga = await sesion(3101, ENTRADA_CARGA);
const con200 = await medirPrediccion(3101, cookieCarga);
cargaServidor.kill();
console.log('200 productos:', con200);

const dist = join(RAIZ, 'frontend', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const archivos = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  (m) => m[1]!,
);
const pesos = archivos.map((a) => {
  const contenido = readFileSync(join(dist, a));
  return {
    archivo: a,
    bytes: contenido.length,
    gzipBytes: gzipSync(contenido, { level: 9 }).length,
    brotliBytes: brotliCompressSync(contenido).length,
  };
});
const js = pesos.filter((p) => p.archivo.endsWith('.js'));
const suma = (xs: typeof js, k: 'bytes' | 'gzipBytes' | 'brotliBytes') =>
  xs.reduce((a, x) => a + x[k], 0);
const diferidos = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js') && !archivos.includes(`assets/${f}`))
  .map((f) => {
    const contenido = readFileSync(join(dist, 'assets', f));
    return {
      archivo: `assets/${f}`,
      bytes: statSync(join(dist, 'assets', f)).size,
      gzipBytes: gzipSync(contenido, { level: 9 }).length,
    };
  });

async function auditar(): Promise<Record<string, unknown>> {
  let ultimo = '';
  for (let intento = 0; intento < 3; intento += 1) {
    const r = await ejecutar('npm', ['audit', '--json']);
    try {
      const json = JSON.parse(r.salida) as Record<string, unknown>;
      if (json['metadata'])
        return { ...json, evidencias: { auditadoEn: new Date().toISOString() } };
    } catch {
      // sin respuesta válida: se reintenta
    }
    ultimo = r.salida.slice(0, 300);
    await pausa(3000);
  }
  const anterior = join(DATOS, 'npm-audit.json');
  if (existsSync(anterior)) {
    const previo = JSON.parse(readFileSync(anterior, 'utf8')) as Record<string, unknown>;
    if (previo['metadata'])
      return {
        ...previo,
        evidencias: { ...(previo['evidencias'] as object), reutilizado: true, motivo: ultimo },
      };
  }
  return { error: ultimo };
}
const audit = await auditar();

writeFileSync(
  join(DATOS, 'rendimiento.json'),
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      entorno: {
        nota: 'Servidor compilado (node dist/server.js) y base de datos local en Docker, en el equipo de desarrollo, sin red de por medio.',
        node: process.version,
        solicitudesPorMedicion: SOLICITUDES,
        meta: 'RNF02: cada pantalla en menos de 2 segundos',
      },
      demo,
      con200Productos: { ...con200, ventasSembradas: carga.ventas },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(DATOS, 'peso-js.json'),
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      inicial: {
        archivos: pesos,
        jsBytes: suma(js, 'bytes'),
        jsGzipBytes: suma(js, 'gzipBytes'),
        jsBrotliBytes: suma(js, 'brotliBytes'),
      },
      metaInternaGzipBytes: 150 * 1024,
      cargadosBajoDemanda: diferidos,
    },
    null,
    2,
  ),
);
writeFileSync(join(DATOS, 'npm-audit.json'), JSON.stringify(audit, null, 2));
await pausa(100);
process.exit(0);
