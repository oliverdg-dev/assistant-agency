import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { TransactionalDb } from "./db.js";

/*
 * Plain SQL migrations, applied in file-name order, each in its own
 * transaction, and recorded with a checksum so an already-applied file can't
 * be edited silently.
 *
 *   db/migrations/*.sql ──▶ loadMigrations ──▶ migrationStatus ──▶ applyMigrations
 *                                               (applied / pending /     (one transaction
 *                                                changed)                 per file)
 */

export interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

export interface MigrationStatus {
  applied: string[];
  pending: Migration[];
  // Applied files whose contents changed since they ran.
  changed: string[];
}

export const MIGRATIONS_DIR = "db/migrations";

const checksumOf = (sql: string) => createHash("sha256").update(sql).digest("hex");

export const loadMigrations = (dir = MIGRATIONS_DIR): Migration[] =>
  readdirSync(dir)
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(path.join(dir, name), "utf8");
      return { name, sql, checksum: checksumOf(sql) };
    });

const ensureTable = (db: TransactionalDb) =>
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

export const migrationStatus = async (
  db: TransactionalDb,
  migrations: Migration[],
): Promise<MigrationStatus> => {
  await ensureTable(db);
  const rows = await db.query<{ name: string; checksum: string }>(
    "SELECT name, checksum FROM schema_migrations ORDER BY name",
  );
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));
  return {
    applied: rows.map((row) => row.name),
    pending: migrations.filter((m) => !applied.has(m.name)),
    changed: migrations.filter((m) => applied.has(m.name) && applied.get(m.name) !== m.checksum).map((m) => m.name),
  };
};

export class MigrationError extends Error {}

// Applies every pending migration. A failing file rolls back on its own and
// stops the run; earlier files stay applied.
export const applyMigrations = async (
  db: TransactionalDb,
  migrations: Migration[],
  log: (line: string) => void = () => {},
): Promise<string[]> => {
  const status = await migrationStatus(db, migrations);
  if (status.changed.length > 0) {
    throw new MigrationError(
      `Already-applied migrations were edited: ${status.changed.join(", ")}. Add a new migration instead.`,
    );
  }
  const done: string[] = [];
  for (const migration of status.pending) {
    try {
      await db.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          migration.name,
          migration.checksum,
        ]);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new MigrationError(`${migration.name} failed and was rolled back: ${reason}`);
    }
    done.push(migration.name);
    log(`applied ${migration.name}`);
  }
  return done;
};

// Refuses to touch the production database unless the operator asked for it
// explicitly, from an interactive terminal, outside a Vercel build.
export const checkMigrationTarget = (target: {
  host: string;
  productionHost?: string;
  interactive: boolean;
  production: boolean;
  vercelEnv?: string;
}): { ok: boolean; reason?: string } => {
  const isProduction = Boolean(target.productionHost) && target.host === target.productionHost;
  if (!isProduction) return { ok: true };
  if (target.vercelEnv && target.vercelEnv !== "production") {
    return { ok: false, reason: `Refusing: a ${target.vercelEnv} build points at the production database.` };
  }
  if (!target.production) {
    return { ok: false, reason: "Refusing: this is the production database. Re-run with --production." };
  }
  if (!target.interactive) {
    return { ok: false, reason: "Refusing: production migrations must be run from an interactive terminal." };
  }
  return { ok: true };
};
