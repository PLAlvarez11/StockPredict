import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';

const app = crearApp();

describe('health', () => {
  it('live responde 200', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('ruta inexistente responde problem+json 404', async () => {
    const res = await request(app).get('/api/v1/nada');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeTruthy();
  });

  it('JSON malformado responde 400', async () => {
    const res = await request(app)
      .post('/api/v1/nada')
      .set('Content-Type', 'application/json')
      .send('{malo');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
