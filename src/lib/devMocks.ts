// Development only: canned /api/booking responses so every form state can be
// checked by URL, e.g. /get-started?mock=500. Loaded through a dynamic import
// inside an `import.meta.env.DEV` check, so production builds don't include it.
export type MockMode = "success" | "success-no-id" | "field-error" | "500" | "504";

export const MOCK_MODES: MockMode[] = ["success", "success-no-id", "field-error", "500", "504"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const mockBookingResponse = async (mode: MockMode): Promise<Response> => {
  await new Promise((resolve) => setTimeout(resolve, 700));
  switch (mode) {
    case "success":
      return json(200, {
        ok: true,
        message: "Thanks, we've received your requirements.",
        leadId: "7f3a2c10-4b6e-4d1a-9c55-0d2e8b1f6a90",
      });
    case "success-no-id":
      return json(200, { ok: true, message: "Thanks, we've received your requirements." });
    case "field-error":
      return json(400, {
        ok: false,
        message: "Please check the highlighted fields and try again.",
        fieldErrors: { sector: "Tell us your industry." },
      });
    case "500":
      return json(500, {
        ok: false,
        message: "We couldn't submit your request right now. Please try again in a moment.",
      });
    case "504":
      return new Response("<html><body>Gateway Timeout</body></html>", {
        status: 504,
        headers: { "Content-Type": "text/html" },
      });
  }
};
