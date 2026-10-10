# CLAUDE.md — StockPredict

Aplicación web mobile-first para controlar catálogo, ventas e inventario y sugerir cuánto comprar la semana siguiente (fórmula PTS). Un solo tipo de usuario; los datos se separan por `usuario_id`. Proyecto de graduación de un solo desarrollador.

Estado: **Fase 1 en curso.** S1 a S3, S4 (ventas), S5 (compra) y S6 (predicción PTS) hechas; dashboard y ajuste manual pendientes; ver `docs/roadmap.md`. Avance el 10/10/2026 (solo localhost, DevTools 390×844); entrega final el 31/10/2026.

## Fuentes de verdad

La carpeta `docs/` existe solo en el disco del autor (no se sube a GitHub). Orden de prioridad cuando haya conflicto:

1. `docs/DAD.md`: requisitos (RF/RNF), base de datos, casos de prueba, fórmula PTS (§3.4.6).
2. `docs/adr/`: decisiones tomadas (0002 recoge los huecos del DAD).
3. `docs/design/StockPredict.dc.html` y `docs/design/_ds/**/styles.css` + `readme.md`: diseño y tokens.
4. `assets/mockups/*.jpg`: capturas de pantallas (se versionan).
5. `docs/analisis.md`, `docs/arquitectura.md`, `docs/roadmap.md`, `docs/checklist-calidad.md`.

Ignorar `docs/design/StockPredict Deck.dc.html`, `deck-stage.js` y `support.js` (no son parte de la app).

Si el DAD contradice el diseño: **avisar antes de decidir**. Los puntos abiertos están en `docs/analisis.md` §3 y §8.

## Stack

Monorepo con npm workspaces (`frontend`, `backend`). TypeScript estricto. React + Vite en el frontend. Node + Express 5 en el backend con API REST en `/api/v1`. PostgreSQL con Prisma. Mailpit para el correo en local. Monolito modular; sin microservicios.

## Comandos

```
npm install            # raíz
npm run db:up          # docker compose up -d (Postgres, Mailpit)
npm run db:migrate     # prisma migrate
npm run db:seed        # datos de demostración
npm run dev            # frontend :5173 y backend :3000
npm test               # Vitest en ambos workspaces
npm run typecheck
npm run lint
npm run build
```

Mailpit UI: http://localhost:8025. Plantilla de variables: `.env.example`.

## Reglas del proyecto

**Proceso**
- Trabajar por slices (S1, S2…) del roadmap; un commit por slice. Máximo 5 preguntas por ronda y solo si algo bloquea.
- Commits pequeños en Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`). No hacer push sin que se pida.
- No agregar comentarios explicativos en el código salvo que el autor lo pida.
- `docs/`, `.env` y `node_modules/` están en `.gitignore`. No subir secretos.

**Negocio** (ADR-0002 y ADR-0005)
- Semana lunes–domingo, zona `America/Guatemala`. Fechas guardadas en UTC (`timestamptz`).
- PTS: V1 más reciente, pesos 0.5/0.3/0.2, sensibilidad 50 %, margen 20 %. Si V2 = 0, factor = 1. Semana sin ventas = 0. Sugerido redondeado hacia arriba. Se calcula con **aritmética entera**, nunca con flotantes.
- Menos de 3 semanas de historial → promedio por producto de la categoría; sin historial → "Sin historial suficiente".
- Stock bajo: `stock ≤ STOCK_BAJO_UMBRAL` (env, default 3).
- Categorías y productos se **inactivan**, no se borran. No se inactiva una categoría con productos activos.
- No se vende más que el stock (V04). Stock nunca negativo (`CHECK` en BD y actualización atómica).
- La fecha de la venta la pone el servidor y no se muestra.
- Ajuste de stock: guarda `stock_anterior`; `cantidad` = nuevo valor.
- Lista fija de 15 íconos de categoría (ADR-0002, D9).

**Backend**
- Capas `routes → controller → service → repository`. Un módulo no importa el repositorio de otro.
- Toda consulta filtra por `usuario_id` de la sesión; recursos ajenos devuelven 404.
- Validar entradas con zod. Errores en formato RFC 9457 (`application/problem+json`) con `code` y `requestId`.
- `pts.ts` y `semana.ts` son funciones puras (sin Prisma, sin `Date.now()`, sin env).
- bcrypt para contraseñas; token de recuperación solo como hash SHA-256, 30 min, un solo uso.
- Logs JSON (pino); nunca registrar contraseñas, tokens ni cuerpos de `/auth/*`.

**Frontend**
- Mobile-first, probado a 390×844. Sin el marco de teléfono del prototipo.
- Estilos solo con tokens de `styles/tokens.css`; sin hex ni px sueltos que el token ya cubra. Tema cálido claro de los mockups (ADR-0008).
- Íconos Phosphor y fuente Inter, autoalojados. Textos en español.
- Accesibilidad WCAG 2.2 AA básica según `docs/checklist-calidad.md`.

## Fuera de alcance hoy (solo bases, sin implementar)

Kubernetes, OpenTelemetry y métricas, MFA/passkeys, RBAC, feature flags, SBOM/gitleaks/SAST/CI completo, backups con RPO/RTO. Ver ADR-0007 y `docs/roadmap.md` §Futuro.

## Pruebas

Los 41 casos del DAD (C, P, V, CO, A, PR, AU) se nombran con su ID en la prueba. La fórmula PTS lleva pruebas unitarias propias, escritas antes del servicio.

## Entorno local (Windows)

- Node 24 LTS instalado con winget. En la shell Bash de Claude Code hay que añadir `/c/Program Files/nodejs` al PATH.
- Docker Desktop debe estar abierto antes de `npm run db:up`.
- Usuario de demostración tras `npm run db:seed`: `demo@stockpredict.local` / `Demo1234!`.
- Versiones fijadas sin `^`. TypeScript 5.9 (la 7.x aún no es compatible con typescript-eslint); Prisma 7.10 (la 8 está en RC).
