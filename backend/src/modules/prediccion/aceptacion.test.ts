import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { semanasCerradas } from '../../shared/time/semana.js';
import {
  crearCatalogoDePrueba,
  crearMailerFalso,
  iniciarSesionDePrueba,
  limpiarBase,
} from '../../../test/helpers.js';
import { calcularPrediccion } from './prediccion.service.js';

const ZONA = 'America/Guatemala';
const app = crearApp({ mailer: crearMailerFalso() });

beforeEach(async () => {
  await limpiarBase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('criterio de aceptación de la predicción', () => {
  it('PR01/PR03: Blusa floral con ventas 5, 6 y 8 y stock 3 → sugerido 10 y comprar 7; al vender 1 unidad sube a 8', async () => {
    const agente = await iniciarSesionDePrueba(app);
    const { subcategoria } = await crearCatalogoDePrueba(agente);
    const creado = await agente
      .post('/api/v1/productos')
      .send({ nombre: 'Blusa floral', subcategoriaId: subcategoria.id, stockInicial: 3 });
    expect(creado.status).toBe(201);
    const productoId = creado.body.id as number;
    const usuarioId = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } }))
      .usuarioId;

    const ahora = new Date();
    const [reciente, media, antigua] = semanasCerradas(ahora, ZONA, 3);
    if (!reciente || !media || !antigua) throw new Error('Faltan semanas');
    const medio = (s: { inicio: Date; fin: Date }) =>
      new Date((s.inicio.getTime() + s.fin.getTime()) / 2);
    await prisma.producto.update({
      where: { id: productoId },
      data: { creadoEn: new Date(antigua.inicio.getTime() - 86_400_000) },
    });
    await prisma.venta.createMany({
      data: [
        { productoId, cantidad: 5, fecha: medio(antigua) },
        { productoId, cantidad: 6, fecha: medio(media) },
        { productoId, cantidad: 8, fecha: medio(reciente) },
      ],
    });

    const antes = (await calcularPrediccion(usuarioId, ahora, ZONA)).items[0];
    expect(antes).toMatchObject({ stockActual: 3, stockSugerido: 10, cantidadAComprar: 7 });

    const venta = await agente.post('/api/v1/ventas').send({ productoId, cantidad: 1 });
    expect(venta.status).toBe(201);

    const despues = (await calcularPrediccion(usuarioId, ahora, ZONA)).items[0];
    expect(despues).toMatchObject({ stockActual: 2, stockSugerido: 10, cantidadAComprar: 8 });
  });
});
