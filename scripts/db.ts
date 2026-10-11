// npm run db:migrate | db:status | db:setup
//
// Targets the local database (.data/pglite) unless you pass --url <postgres-url>.
// It never reads POSTGRES_URL by itself, so a production URL in your shell
// can't be migrated by accident. Production also needs --production, an
// interactive terminal and PRODUCTION_DB_HOST set (see docs/RUNBOOK.md).
import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Pool } from "@neondatabase/serverless";
import type { TransactionalDb } from "../api/_lib/db.js";
import { LOCAL_DB_DIR, localDbExists, openLocalDb } from "../api/_lib/dbLocal.js";
import {
  applyMigrations,
  checkMigrationTarget,
  loadMigrations,
  migrationStatus,
} from "../api/_lib/migrate.js";

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => args.includes(name);
const urlArg = (() => {
  const index = args.indexOf("--url");
  return index >= 0 ? args[index + 1] : undefined;
})();

const remoteDb = (url: string): { db: TransactionalDb; close: () => Promise<void> } => {
  // A pool (WebSocket) connection, because migrations need real transactions.
  const pool = new Pool({ connectionString: url });
  const fromClient = (client: { query: Pool["query"] }): TransactionalDb => ({
    query: async <T>(text: string, params: unknown[] = []) =>
      (await client.query(text, params)).rows as T[],
    exec: async (sql: string) => {
      await client.query(sql);
    },
    transaction: async (fn) => {
      const conn = await pool.connect();
      try {
        await conn.query("BEGIN");
        const result = await fn(fromClient(conn as unknown as { query: Pool["query"] }));
        await conn.query("COMMIT");
        return result;
      } catch (error) {
        await conn.query("ROLLBACK");
        throw error;
      } finally {
        conn.release();
      }
    },
  });
  return { db: fromClient(pool), close: () => pool.end() };
};

const confirm = async (question: string) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
};

async function main() {
  if (!["migrate", "status", "setup"].includes(command ?? "")) {
    console.error("Usage: npm run db:migrate | db:status | db:setup [-- --url <postgres-url> [--production] [--dry-run]]");
    process.exit(2);
  }

  let target: { db: TransactionalDb; close: () => Promise<void> };
  if (urlArg) {
    const host = new URL(urlArg).hostname;
    const check = checkMigrationTarget({
      host,
      productionHost: process.env.PRODUCTION_DB_HOST,
      interactive: Boolean(process.stdin.isTTY),
      production: flag("--production"),
      vercelEnv: process.env.VERCEL_ENV,
    });
    if (!check.ok) {
      console.error(check.reason);
      process.exit(1);
    }
    console.log(`Target: ${host}`);
    if (host === process.env.PRODUCTION_DB_HOST && command !== "status") {
      const typed = await confirm(`Type the production host (${host}) to continue: `);
      if (typed !== host) {
        console.error("Cancelled.");
        process.exit(1);
      }
    }
    target = remoteDb(urlArg);
  } else {
    if (command === "status" && !localDbExists()) {
      console.log("No local database yet. Run npm run db:setup to create it.");
      return;
    }
    mkdirSync(LOCAL_DB_DIR, { recursive: true });
    console.log(`Target: local database (${LOCAL_DB_DIR})`);
    target = await openLocalDb(LOCAL_DB_DIR);
  }

  try {
    const migrations = loadMigrations();
    const status = await migrationStatus(target.db, migrations);
    console.log(`Applied: ${status.applied.length ? status.applied.join(", ") : "none"}`);
    console.log(`Pending: ${status.pending.length ? status.pending.map((m) => m.name).join(", ") : "none"}`);
    if (status.changed.length) console.log(`Edited after applying: ${status.changed.join(", ")}`);

    if (command === "status") return;
    if (flag("--dry-run")) {
      for (const migration of status.pending) console.log(`\n-- ${migration.name}\n${migration.sql}`);
      return;
    }
    const applied = await applyMigrations(target.db, migrations, (line) => console.log(line));
    console.log(applied.length ? `Done: ${applied.length} applied.` : "Nothing to apply.");
  } finally {
    await target.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
