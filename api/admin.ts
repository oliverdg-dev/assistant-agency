import type { IncomingMessage, ServerResponse } from "node:http";
import { adminEnabled, handleAdminRequest } from "./_lib/adminApi.js";
import { productionAdminDeps } from "./_lib/adminServer.js";
import { apiError, API_HEADERS, toApiRequest, writeApiResponse } from "./_lib/http.js";

// All of /api/admin/* lands here (vercel.json rewrites it to ?path=...).
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Off unless FEATURE_ADMIN=1 is set in Vercel; looks like any unknown URL.
  if (!adminEnabled()) {
    return writeApiResponse(res, { ...apiError(404, "not_found", "Not found."), headers: API_HEADERS });
  }
  const deps = productionAdminDeps();
  if (!deps) {
    console.error("Admin config: missing POSTGRES_URL");
    return writeApiResponse(res, {
      ...apiError(503, "internal", "The staff area isn't set up yet."),
      headers: API_HEADERS,
    });
  }
  const request = await toApiRequest(req, "query");
  if ("status" in request) return writeApiResponse(res, { ...request, headers: API_HEADERS });
  return writeApiResponse(res, await handleAdminRequest(request, deps));
}
