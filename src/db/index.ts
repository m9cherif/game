import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Database connection (lazy-initialized).
 *
 * The pool is NOT created at module-load time so that `next build` can succeed
 * in environments where DATABASE_URL is not yet configured (e.g. CI, preview
 * deploys, static-hosting builds). The pool is created on first use.
 *
 * If DATABASE_URL is missing, the getter returns `null` and API routes return
 * a 503-style "database not configured" response instead of crashing the
 * server (or the build).
 */
const databaseUrl = process.env.DATABASE_URL?.trim() || "";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool | null {
  if (!databaseUrl) return null;
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  const pool = new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  return pool;
}

// Lazily-resolved pool + drizzle instance.
// We intentionally do NOT throw at import time; missing DB becomes a runtime 503.
let _pool: Pool | null | undefined = undefined;
let _db: ReturnType<typeof drizzle> | null = null;

export function getPool(): Pool | null {
  if (_pool === undefined) _pool = createPool();
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  const pool = getPool();
  if (!pool) return null;
  _db = drizzle(pool);
  return _db;
}

/**
 * Convenience export used by existing routes; returns the drizzle instance or
 * throws a *catchable* error at call-time (not import-time). API routes wrap
 * calls in try/catch and surface a 503 when the DB is unavailable.
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getDb();
      if (!instance) {
        throw new DbNotConfiguredError();
      }
      return Reflect.get(instance, prop);
    },
  },
) as ReturnType<typeof drizzle>;

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DbNotConfiguredError";
  }
}

export function isDbConfigured(): boolean {
  return Boolean(databaseUrl);
}
