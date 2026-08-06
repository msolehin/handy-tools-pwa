// SenangKit server entry. Serves the built SPA and /api from one origin so the session
// cookie can be httpOnly SameSite=Lax with no CORS.
//
// Run: node server/index.ts   (Node >=22.18 strips the types natively — no build step,
// but relative imports need explicit .ts extensions and no enum/namespace/decorators.)
import { serve } from '@hono/node-server';
import { app } from './app.ts';
import { hasDb, migrate } from './db.ts';
import { GOOGLE_CLIENT_ID } from './auth.ts';

// Before listening: a failed migration exits the process and Railway keeps the previous
// deploy live, which is the behaviour we want.
await migrate();

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `SenangKit listening on :${info.port} (db=${hasDb}, auth=${Boolean(GOOGLE_CLIENT_ID)})`);
});
