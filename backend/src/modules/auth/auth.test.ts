import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { crearMailerFalso, limpiarBase } from '../../../test/helpers.js';

const limites = {
  loginMax: 1000,
  loginVentanaMin: 15,
  recuperarMax: 1000,
  recuperarVentanaMin: 60,
};
const VALIDO = { nombre: 'Valesca', correo: 'valesca@ejemplo.com', contrasena: 'ClaveSegura1' };

let mailer = crearMailerFalso();
let app = crearApp({ mailer, limites });

beforeEach(async () => {
  await limpiarBase();
  mailer = crearMailerFalso();
  app = crearApp({ mailer, limites });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const registrar = (datos: object = VALIDO) =>
  request(app).post('/api/v1/auth/registro').send(datos);

function extraerToken(): string {
  const texto = mailer.enviados[0]?.texto ?? '';
  const token = /token=([\w-]+)/.exec(texto)?.[1];
  if (!token) throw new Error('El correo no contiene token');
  return token;
}

describe('AU01 registro', () => {
  it('registra con datos válidos, normaliza el correo y abre sesión', async () => {
    const res = await registrar({ ...VALIDO, correo: '  Valesca@Ejemplo.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nombre: 'Valesca', correo: 'valesca@ejemplo.com' });
    expect(res.body.usuario.contrasenaHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('sp_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('guarda la contraseña con hash bcrypt', async () => {
    await registrar();
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { correo: VALIDO.correo } });
    expect(usuario.contrasenaHash).toMatch(/^\$2[aby]\$/);
    expect(usuario.contrasenaHash).not.toContain(VALIDO.contrasena);
  });

  it('rechaza contraseña corta, correo inválido y nombre vacío con errores por campo', async () => {
    const res = await registrar({ nombre: ' ', correo: 'no-es-correo', contrasena: '123' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const campos = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(campos).toEqual(['contrasena', 'correo', 'nombre']);
  });

  it('rechaza contraseñas de más de 72 bytes', async () => {
    const res = await registrar({ ...VALIDO, contrasena: 'a'.repeat(73) });
    expect(res.status).toBe(422);
  });
});

describe('AU07 correo duplicado', () => {
  it('responde 409 EMAIL_TAKEN', async () => {
    await registrar();
    const res = await registrar({ ...VALIDO, correo: 'VALESCA@ejemplo.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });
});

describe('AU02 y AU05 login', () => {
  beforeEach(async () => {
    await registrar();
  });

  it('AU02: inicia sesión y /me devuelve el perfil', async () => {
    const agente = request.agent(app);
    const login = await agente
      .post('/api/v1/auth/login')
      .send({ correo: VALIDO.correo, contrasena: VALIDO.contrasena });
    expect(login.status).toBe(200);
    const me = await agente.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ nombre: 'Valesca', correo: VALIDO.correo });
  });

  it('AU05: contraseña incorrecta devuelve 401 genérico sin cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: VALIDO.correo, contrasena: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Correo o contraseña incorrectos.');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('correo inexistente devuelve exactamente el mismo error que contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: 'nadie@ejemplo.com', contrasena: 'cualquiera1' });
    expect(res.status).toBe(401);
    expect(res.body.detail).toBe('Correo o contraseña incorrectos.');
  });

  it('/me sin sesión devuelve 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('logout borra la sesión', async () => {
    const agente = request.agent(app);
    await agente
      .post('/api/v1/auth/login')
      .send({ correo: VALIDO.correo, contrasena: VALIDO.contrasena });
    const salida = await agente.post('/api/v1/auth/logout');
    expect(salida.status).toBe(204);
    const me = await agente.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('rechaza una cookie manipulada', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', 'sp_session=abc.def.ghi');
    expect(res.status).toBe(401);
  });
});

describe('AU03 y AU06 recuperar', () => {
  beforeEach(async () => {
    await registrar();
  });

  it('AU03: correo existente envía un enlace con token y guarda solo su hash', async () => {
    const res = await request(app).post('/api/v1/auth/recuperar').send({ correo: VALIDO.correo });
    expect(res.status).toBe(202);
    expect(mailer.enviados).toHaveLength(1);
    expect(mailer.enviados[0]?.para).toBe(VALIDO.correo);
    const token = extraerToken();
    const guardados = await prisma.tokenRecuperacion.findMany();
    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.tokenHash).toHaveLength(64);
    expect(guardados[0]?.tokenHash).not.toContain(token);
    const minutos = ((guardados[0]?.expiraEn.getTime() ?? 0) - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(29);
    expect(minutos).toBeLessThanOrEqual(30);
  });

  it('AU06: correo inexistente no envía correo y responde igual que el existente', async () => {
    const existente = await request(app)
      .post('/api/v1/auth/recuperar')
      .send({ correo: VALIDO.correo });
    mailer.enviados.length = 0;
    const inexistente = await request(app)
      .post('/api/v1/auth/recuperar')
      .send({ correo: 'nadie@ejemplo.com' });
    expect(inexistente.status).toBe(existente.status);
    expect(inexistente.body).toEqual(existente.body);
    expect(mailer.enviados).toHaveLength(0);
  });

  it('un token nuevo invalida el anterior', async () => {
    await request(app).post('/api/v1/auth/recuperar').send({ correo: VALIDO.correo });
    const primero = extraerToken();
    mailer.enviados.length = 0;
    await request(app).post('/api/v1/auth/recuperar').send({ correo: VALIDO.correo });
    const viejo = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: primero, contrasena: 'NuevaClave123' });
    expect(viejo.status).toBe(410);
    const nuevo = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: extraerToken(), contrasena: 'NuevaClave123' });
    expect(nuevo.status).toBe(204);
  });
});

describe('AU04 restablecer', () => {
  beforeEach(async () => {
    await registrar();
    await request(app).post('/api/v1/auth/recuperar').send({ correo: VALIDO.correo });
  });

  it('cambia la contraseña, permite entrar con la nueva y no con la anterior', async () => {
    const res = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: extraerToken(), contrasena: 'NuevaClave123' });
    expect(res.status).toBe(204);
    const viejo = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: VALIDO.correo, contrasena: VALIDO.contrasena });
    expect(viejo.status).toBe(401);
    const nuevo = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: VALIDO.correo, contrasena: 'NuevaClave123' });
    expect(nuevo.status).toBe(200);
  });

  it('el token es de un solo uso', async () => {
    const token = extraerToken();
    await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token, contrasena: 'NuevaClave123' });
    const otra = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token, contrasena: 'OtraClave1234' });
    expect(otra.status).toBe(410);
    expect(otra.body.code).toBe('TOKEN_INVALID');
  });

  it('un token vencido se rechaza', async () => {
    await prisma.tokenRecuperacion.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
    const res = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: extraerToken(), contrasena: 'NuevaClave123' });
    expect(res.status).toBe(410);
  });

  it('un token inventado se rechaza', async () => {
    const res = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: 'x'.repeat(43), contrasena: 'NuevaClave123' });
    expect(res.status).toBe(410);
  });

  it('valida la nueva contraseña', async () => {
    const res = await request(app)
      .post('/api/v1/auth/restablecer')
      .send({ token: extraerToken(), contrasena: 'corta' });
    expect(res.status).toBe(422);
  });
});

describe('protecciones', () => {
  it('limita los intentos fallidos de login con 429 y Retry-After', async () => {
    const limitada = crearApp({ mailer, limites: { ...limites, loginMax: 3 } });
    await request(limitada).post('/api/v1/auth/registro').send(VALIDO);
    const intento = () =>
      request(limitada)
        .post('/api/v1/auth/login')
        .send({ correo: VALIDO.correo, contrasena: 'mala' });
    for (let i = 0; i < 3; i += 1) expect((await intento()).status).toBe(401);
    const bloqueado = await intento();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.code).toBe('RATE_LIMITED');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limita las solicitudes de recuperación', async () => {
    const limitada = crearApp({ mailer, limites: { ...limites, recuperarMax: 2 } });
    const pedir = () =>
      request(limitada).post('/api/v1/auth/recuperar').send({ correo: 'a@ejemplo.com' });
    expect((await pedir()).status).toBe(202);
    expect((await pedir()).status).toBe(202);
    expect((await pedir()).status).toBe(429);
  });

  it('rechaza mutaciones desde un origen no permitido', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://malo.example')
      .send({ correo: 'a@b.co', contrasena: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('acepta mutaciones desde el origen configurado', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ correo: 'a@b.co', contrasena: 'x' });
    expect(res.status).toBe(401);
  });

  it('rechaza campos desconocidos', async () => {
    const res = await registrar({ ...VALIDO, rol: 'admin' });
    expect(res.status).toBe(422);
  });
});
