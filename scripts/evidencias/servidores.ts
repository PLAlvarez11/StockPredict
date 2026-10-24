import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const DATOS = join(RAIZ, 'docs', 'evidencias', 'datos');
export const URL_DEMO =
  'postgresql://stockpredict:stockpredict@localhost:5432/stockpredict?schema=public';
export const URL_PRUEBAS =
  'postgresql://stockpredict:stockpredict@localhost:5432/stockpredict_test?schema=public';

export const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function recortar(valores: number[], p: number): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil(p * ordenados.length) - 1)]!;
}

export async function esperarUrl(url: string, intentos = 60): Promise<void> {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      // el servidor aún no responde
    }
    await pausa(500);
  }
  throw new Error(`No respondió: ${url}`);
}

export async function iniciarBackend(puerto: number, baseDeDatos: string): Promise<ChildProcess> {
  const proceso = spawn(process.execPath, ['dist/server.js'], {
    cwd: join(RAIZ, 'backend'),
    env: {
      ...process.env,
      PORT: String(puerto),
      DATABASE_URL: baseDeDatos,
      NODE_ENV: 'development',
      LOG_LEVEL: 'silent',
      BCRYPT_COST: '4',
    },
    stdio: 'ignore',
  });
  await esperarUrl(`http://127.0.0.1:${puerto}/api/v1/health/live`);
  return proceso;
}

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

export function iniciarFrontend(puerto: number, puertoApi: number): Promise<http.Server> {
  const dist = join(RAIZ, 'frontend', 'dist');
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api')) {
      const proxy = http.request(
        {
          host: '127.0.0.1',
          port: puertoApi,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${puerto}` },
        },
        (respuesta) => {
          res.writeHead(respuesta.statusCode ?? 502, respuesta.headers);
          respuesta.pipe(res);
        },
      );
      proxy.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(proxy);
      return;
    }
    let ruta = normalize(join(dist, decodeURIComponent(url.pathname)));
    if (!ruta.startsWith(dist) || !existsSync(ruta) || statSync(ruta).isDirectory()) {
      ruta = join(dist, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
    createReadStream(ruta).pipe(res);
  });
  return new Promise((resolve) => servidor.listen(puerto, '127.0.0.1', () => resolve(servidor)));
}

export function ejecutar(
  comando: string,
  args: string[],
  opciones: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ codigo: number; salida: string }> {
  return new Promise((resolve) => {
    const proceso = spawn(comando, args, {
      cwd: opciones.cwd ?? RAIZ,
      env: { ...process.env, ...opciones.env },
      shell: process.platform === 'win32',
    });
    let salida = '';
    proceso.stdout.on('data', (d: Buffer) => (salida += d.toString()));
    proceso.stderr.on('data', (d: Buffer) => (salida += d.toString()));
    proceso.on('close', (codigo) => resolve({ codigo: codigo ?? 1, salida }));
  });
}

export function rutaChrome(): string {
  const candidatas = [
    process.env['CHROME_PATH'],
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const ruta = candidatas.find((c) => c && existsSync(c));
  if (!ruta) throw new Error('No se encontró Chrome. Define CHROME_PATH.');
  return ruta;
}
