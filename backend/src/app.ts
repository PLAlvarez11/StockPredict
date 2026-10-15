import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { crearSmtpMailer, type Mailer } from './mail/mailer.js';
import {
  crearAuthRouter,
  limitesPorDefecto,
  type LimitesAuth,
} from './modules/auth/auth.routes.js';
import { crearAuthService } from './modules/auth/auth.service.js';
import { categoriasRouter } from './modules/categorias/categorias.routes.js';
import { inventarioRouter } from './modules/inventario/inventario.routes.js';
import { prediccionRouter } from './modules/prediccion/prediccion.routes.js';
import { productosRouter } from './modules/productos/productos.routes.js';
import { subcategoriasRouter } from './modules/subcategorias/subcategorias.routes.js';
import { ventasRouter } from './modules/ventas/ventas.routes.js';
import { bcryptHasher, type PasswordHasher } from './modules/auth/password-hasher.js';
import { healthRouter } from './modules/health/health.routes.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/errors/error-handler.js';
import { verificarOrigen } from './shared/http/origen.js';
import { logger } from './shared/logger.js';

const UMBRAL_LENTA_MS = 2000;

export interface OpcionesApp {
  mailer?: Mailer;
  hasher?: PasswordHasher;
  limites?: LimitesAuth;
}

export function crearApp(opciones: OpcionesApp = {}): Express {
  const app = express();
  const mailer = opciones.mailer ?? crearSmtpMailer();
  const hasher = opciones.hasher ?? bcryptHasher;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.includes('/health/') ?? false },
    }),
  );
  app.use((req, res, next) => {
    const inicio = performance.now();
    res.on('finish', () => {
      const duracionMs = Math.round(performance.now() - inicio);
      if (duracionMs >= UMBRAL_LENTA_MS) {
        logger.warn(
          { metodo: req.method, ruta: req.path, estado: res.statusCode, duracionMs },
          'Solicitud lenta (RNF02)',
        );
      }
    });
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use(verificarOrigen);

  const api = express.Router();
  api.use('/health', healthRouter);
  const authService = crearAuthService({ hasher, mailer });
  app.locals['esperarTareas'] = authService.esperarTareas;
  api.use('/auth', crearAuthRouter(authService, opciones.limites ?? limitesPorDefecto()));
  api.use('/categorias', categoriasRouter);
  api.use('/subcategorias', subcategoriasRouter);
  api.use('/productos', productosRouter);
  api.use('/ventas', ventasRouter);
  api.use('/inventario', inventarioRouter);
  api.use('/prediccion', prediccionRouter);
  app.use('/api/v1', api);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}
