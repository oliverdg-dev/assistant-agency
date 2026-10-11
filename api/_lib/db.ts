import { neon } from "@neondatabase/serverless";

/*
 * The one query interface the server code uses. Production talks to Neon over
 * HTTP (one statement per call, no keys or sockets to manage). Local
 * development and tests use an in-process Postgres (api/_lib/dbLocal.ts), so
 * nothing local ever needs production credentials.
 *
 *   server code ──▶ Db.query(text, params)
 *                     ├─ neonHttpDb   (production, Vercel)
 *                     └─ pgliteDb     (npm run dev with a local database, tests)
 *
 * Multi-statement writes must be a single SQL statement (a CTE) or go through
 * `transaction`, which only the migration runner and local databases provide
 * today. Neon's HTTP driver cannot hold a transaction open across calls.
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface TransactionalDb extends Db {
  // Runs a script that may contain several statements (migrations).
  exec(sql: string): Promise<void>;
  transaction<R>(fn: (tx: TransactionalDb) => Promise<R>): Promise<R>;
}

export const neonHttpDb = (connectionString: string): Db => {
  const sql = neon(connectionString);
  return {
    query: async <T>(text: string, params: unknown[] = []) =>
      (await sql.query(text, params)) as T[],
  };
};

// The database URL the deployed functions use. Local tools never read it
// implicitly (see scripts/db.ts).
export const databaseUrlFromEnv = (env = process.env): string =>
  env.POSTGRES_URL ?? env.DATABASE_URL ?? "";
