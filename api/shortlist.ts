import type { IncomingMessage, ServerResponse } from "node:http";
import { productionAdminDeps } from "./_lib/adminServer.js";
import { apiError, API_HEADERS, toApiRequest, writeApiResponse } from "./_lib/http.js";
import { handleShortlistRequest, shortlistEnabled } from "./_lib/shortlistApi.js";

// All of /api/shortlist/* lands here (vercel.json rewrites it to ?path=...).
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Off unless FEATURE_SHORTLIST=1 is set in Vercel; looks like any unknown URL.
  if (!shortlistEnabled()) {
    return writeApiResponse(res, { ...apiError(404, "not_found", "Not found."), headers: API_HEADERS });
  }
  const deps = productionAdminDeps();
  if (!deps) {
    console.error("Shortlist config: missing POSTGRES_URL");
    return writeApiResponse(res, { ...apiError(503, "internal", "This page isn't available right now."), headers: API_HEADERS });
  }
  const request = await toApiRequest(req, "query");
  if ("status" in request) return writeApiResponse(res, { ...request, headers: API_HEADERS });
  return writeApiResponse(res, await handleShortlistRequest(request, deps));
}
