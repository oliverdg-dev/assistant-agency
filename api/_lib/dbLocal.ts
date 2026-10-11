// In-process Postgres (PGlite) for local development and tests. Never imported
// by a deployed function: only vite.config.ts (through bookingDev.ts and adminDev.ts),
// scripts/db.ts and tests use it.
import { existsSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { TransactionalDb } from "./db.js";

// Where `npm run db:setup` keeps the local database. Ignored by git.
export const LOCAL_DB_DIR = ".data/pglite";

// True once a database has been created there (an empty folder doesn't count).
export const localDbExists = (dir = LOCAL_DB_DIR): boolean => existsSync(path.join(dir, "PG_VERSION"));

interface PgliteLike {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

const wrap = (pg: PgliteLike, transaction: TransactionalDb["transaction"]): TransactionalDb => ({
  query: async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
  exec: async (sql: string) => {
    await pg.exec(sql);
  },
  transaction,
});

export const pgliteDb = (pg: PGlite): TransactionalDb => {
  const db: TransactionalDb = wrap(pg, (fn) =>
    pg.transaction((tx) => {
      // Nested transactions are not supported; the inner db reuses this one.
      const inner: TransactionalDb = wrap(tx, (nested) => nested(inner));
      return fn(inner);
    }),
  );
  return db;
};

// `dataDir` undefined = a fresh in-memory database (tests).
export const openLocalDb = async (dataDir?: string): Promise<{ db: TransactionalDb; close: () => Promise<void> }> => {
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return { db: pgliteDb(pg), close: () => pg.close() };
};

// The dev server's one connection to .data/pglite, shared by the booking form
// and the staff area (PGlite allows a single process, and one handle in it).
let shared: Promise<TransactionalDb> | undefined;
export const sharedLocalDb = (): Promise<TransactionalDb> =>
  (shared ??= openLocalDb(LOCAL_DB_DIR).then((local) => local.db));
