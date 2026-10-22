# StockPredict

Aplicación web, pensada para usarse desde el celular, para controlar el catálogo, las ventas y el inventario de un negocio que vende por temporadas (oleadas), y para sugerir cuánto comprar la semana siguiente. El proyecto nace como Proyecto de Graduación en Ingeniería en Sistemas de la Universidad Mariano Gálvez.

## ¿Qué resuelve?

Muchos negocios pequeños que venden por temporada (ropa, maquillaje, accesorios, etc.) no tienen forma de saber cuánto producto conviene comprar para la siguiente semana. Terminan comprando "a ojo", lo que provoca dos problemas constantes: quedarse sin stock de lo que sí se vende (perdiendo clientas) o comprar de más de lo que no rota (dinero quieto).

StockPredict lleva el control del catálogo, registra las ventas semana a semana y, con ese historial, sugiere cuánto comprar con una fórmula propia (PTS: Ponderación, Tendencia y Seguridad).

## Qué incluye hoy

- Registro e inicio de sesión, con recuperación de contraseña por correo.
- Categorías (con uno de 15 íconos), subcategorías y productos con descripción opcional. Todo se puede desactivar y volver a activar; nada se borra.
- Detalle de cada producto, con la gráfica de sus compras de las últimas 12 semanas.
- Registro de ventas, de compras a proveedor y ajuste manual de stock, con confirmación. No se vende más de lo que hay en stock.
- Predicción de cuánto comprar la semana siguiente con la fórmula PTS: usa las últimas 3 semanas cerradas (lunes a domingo, hora de Guatemala) y, si el producto es nuevo, el promedio de su subcategoría o de su categoría. La lista se ordena por necesidad en porcentaje, con semáforo, búsqueda, filtros y el detalle del cálculo.
- Simulador de stock para estimar cuánto comprar de un producto nuevo, sin guardar nada.
- Exportar la predicción en PDF, Excel y CSV, y compartirla con el menú del teléfono (si el navegador lo permite) o descargarla.
- Inicio con saludo, conteo de productos activos y con stock bajo, accesos rápidos, la gráfica de ventas de la semana y un resumen de lo que conviene comprar.
- Buscador en Productos, Categorías, Inventario y Predicción.

## Qué no incluye todavía

- Precios, calculadora de precios y fotos de los productos.
- Notificaciones, WhatsApp y pagos.
- Exportar el historial de ventas y de compras.
- Modo sin conexión.
- Publicación en Internet: el sistema corre en el equipo de desarrollo.

## Tecnologías

Monorepo con npm workspaces (`frontend` y `backend`), TypeScript estricto.

- Frontend: React, Vite, React Router, TanStack Query, React Hook Form. Íconos Phosphor y fuente Inter.
- Backend: Node.js 24, Express 5, Zod, bcrypt, pino. API REST en `/api/v1`.
- Base de datos: PostgreSQL con Prisma. Correo de pruebas con Mailpit.
- Archivos exportados: pdfkit y write-excel-file.
- Pruebas: Vitest.

## Cómo correrlo en local

Requisitos: Node.js 24 y Docker Desktop abierto.

```
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Correo de pruebas (Mailpit): http://localhost:8025
- Usuario de demostración tras `npm run db:seed`: `demo@stockpredict.local` / `Demo1234!`

Otros comandos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` y `npm run db:reset-demo` (vacía las tablas y deja los datos de la demo; solo para desarrollo).

## Documentación

La documentación técnica (Documento de Análisis y Diseño, análisis, arquitectura, decisiones y roadmap) no se incluye en este repositorio: se entrega por separado. El DAD detalla el alcance, los requisitos, el diseño de base de datos y los casos de prueba.

- [Mockups de las pantallas](./assets/mockups)

## Estructura del repositorio

- `frontend/`: interfaz web.
- `backend/`: API, fórmula PTS, generación de archivos, pruebas, esquema de Prisma, migraciones y datos de demostración.
- `database/`: cómo cargar los datos de prueba.
- `assets/mockups/`: capturas de las pantallas.
- `docker-compose.yml` y `.env.example`: PostgreSQL, Mailpit y plantilla de variables.
