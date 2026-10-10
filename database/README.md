# database

El esquema y las migraciones se gestionan con Prisma y viven en [`backend/prisma/`](../backend/prisma):

- `schema.prisma`: modelos.
- `migrations/<fecha>_<nombre>/migration.sql`: SQL aplicado por Prisma, incluidos los `CHECK` y los índices únicos parciales que Prisma no modela.
- `migrations/<fecha>_<nombre>/down.sql`: reversión manual de esa migración (Prisma no ejecuta migraciones "down").
- `seed.ts`: datos de demostración.

Esta carpeta queda reservada para SQL auxiliar (consultas de verificación, scripts puntuales). No contiene el esquema.

## Datos de prueba (seed)

```
npm run db:up
npm run db:migrate
npm run db:seed
```

El seed borra y recrea al usuario de demostración, de modo que se puede ejecutar varias veces.

| Dato | Valor |
|---|---|
| Correo | `demo@stockpredict.local` |
| Contraseña | `Demo1234!` |
| Categorías | Ropa, Maquillaje, Bolsos, Perfumes, Accesorios |
| Productos | 12 (los del diseño), con el stock del mockup |
| Ventas | 4 semanas cerradas completas más la semana en curso, con fechas relativas al día en que se ejecuta el seed |

El producto "Pulsera set 3 piezas" se crea hace 6 días y no tiene ventas en semanas cerradas, así que la predicción usa el respaldo por categoría. El resto tiene historial propio.

El seed no se ejecuta con `NODE_ENV=production`.

## Reiniciar la base de desarrollo

```
npm run db:reset
npm run db:seed
```
