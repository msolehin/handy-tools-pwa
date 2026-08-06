import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';

// No DATABASE_URL yet (first Railway deploy, or a local checkout with no Postgres) is not a
// crash: the app is offline-first and every tool works without an account. Auth and sync
// return 503 until the database is attached.
export const hasDb = Boolean(process.env.DATABASE_URL);

// Railway's starter Postgres has a modest connection cap and one instance doesn't need more.
export const pool = hasDb
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

export function db(): Pool {
  if (!pool) throw new Error('DATABASE_URL is not set');
  return pool;
}

export const q = (sql: string, params?: unknown[]) => db().query(sql, params);

/** Run each unapplied migration in its own transaction. Forward-only, no down files. */
export async function migrate() {
  if (!pool) {
    console.warn('DATABASE_URL not set — skipping migrations, running without accounts');
    return;
  }
  // Two Railway replicas booting at once must not race each other.
  await pool.query('select pg_advisory_lock(4242)');
  try {
    await pool.query(
      `create table if not exists _migrations(
         name text primary key,
         at   timestamptz not null default now()
       )`);
    const done = new Set(
      (await pool.query('select name from _migrations')).rows.map((r) => r.name as string));

    const dir = new URL('./migrations/', import.meta.url);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(new URL(file, dir), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into _migrations(name) values($1)', [file]);
        await client.query('commit');
        console.log('migrated', file);
      } catch (err) {
        await client.query('rollback');
        throw err; // process exits, Railway keeps the previous deploy live
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.query('select pg_advisory_unlock(4242)');
  }
}

/** Run fn inside a transaction, rolling back on any throw. */
export async function tx<T>(fn: (query: typeof q) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('begin');
    const result = await fn((sql, params) => client.query(sql, params));
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
