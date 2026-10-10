import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';
import { URL_BASE_PRUEBAS } from './entorno.js';

const require = createRequire(import.meta.url);

export default async function setup() {
  const url = URL_BASE_PRUEBAS;
  const destino = new URL(url);
  const nombre = destino.pathname.slice(1);
  if (!nombre.endsWith('_test')) {
    throw new Error(`Las pruebas solo corren contra una base *_test (recibida: ${nombre})`);
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (existe.rowCount === 0) {
    await cliente.query(`CREATE DATABASE "${nombre}"`);
  }
  await cliente.end();

  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
