// The staff area during `npm run dev`. Uses POSTGRES_URL if set, otherwise the
// local database from `npm run db:setup`. Never imported by a deployed function.
import { handleAdminRequest, type AdminDeps } from "./adminApi.js";
import { adminDepsFor } from "./adminServer.js";
import { databaseUrlFromEnv, neonHttpDb, type Db } from "./db.js";
import { localDbExists, sharedLocalDb } from "./dbLocal.js";
import { apiError, type ApiRequest, type ApiResponse } from "./http.js";
import { loadMigrations, migrationStatus } from "./migrate.js";
import { handleShortlistRequest } from "./shortlistApi.js";

const needsSetup = (message: string) => apiError(503, "setup_required", message);

// One handler per area, sharing the same setup checks and database.
export const devAdminHandler = (env = process.env) => devHandler(env, "The staff area", handleAdminRequest);
export const devShortlistHandler = (env = process.env) => devHandler(env, "Shortlist links", handleShortlistRequest);

const devHandler = (
  env: NodeJS.ProcessEnv,
  label: string,
  handle: (req: ApiRequest, deps: AdminDeps) => Promise<ApiResponse>,
) => {
  let ready: Promise<AdminDeps | ApiResponse> | undefined;

  const prepare = async (): Promise<AdminDeps | ApiResponse> => {
    const url = databaseUrlFromEnv(env);
    let db: Db;
    if (url) {
      db = neonHttpDb(url);
    } else if (localDbExists()) {
      const local = await sharedLocalDb();
      const status = await migrationStatus(local, loadMigrations());
      if (status.pending.length > 0) {
        return needsSetup("The local database is missing updates. Run npm run db:migrate, then restart npm run dev.");
      }
      db = local;
    } else {
      return needsSetup(`${label} need${label.endsWith("s") ? "" : "s"} a database. Run npm run db:setup, then restart npm run dev.`);
    }
    console.info(`${label} (dev): ${url ? "POSTGRES_URL" : "local database"}. Emails print here unless Resend is configured.`);
    return adminDepsFor(db, env, { dev: true });
  };

  return async (req: ApiRequest): Promise<ApiResponse> => {
    ready ??= prepare();
    const deps = await ready;
    if ("status" in deps) {
      ready = undefined; // check again next time, after the developer fixes it
      return deps;
    }
    return handle(req, deps);
  };
};
