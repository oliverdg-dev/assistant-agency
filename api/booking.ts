import {
  handleBookingHttp,
  logBookingConfigOnce,
  UNREADABLE_BODY,
} from "./_lib/bookingApi.js";

export default async function handler(req: any, res: any) {
  logBookingConfigOnce();

  // Vercel parses JSON bodies lazily; reading req.body throws on malformed JSON.
  let body: unknown;
  try {
    body = req.body;
  } catch {
    body = UNREADABLE_BODY;
  }

  const result = await handleBookingHttp({ method: req.method, body });
  for (const [name, value] of Object.entries(result.headers ?? {})) {
    res.setHeader(name, value);
  }
  return res.status(result.status).json(result.body);
}
