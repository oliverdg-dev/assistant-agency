import type { BookingFormData } from "../../api/_lib/booking.js";

/*
 * Where a visitor came from, captured once on the first page of their visit
 * (src/main.tsx) and sent with the job request. Kept in sessionStorage, so it
 * covers one visit and nothing persists across visits. The referrer keeps
 * only origin and path: query strings can carry other sites' tracking or
 * personal data.
 */

export type Attribution = Pick<
  BookingFormData,
  "landingPath" | "referrer" | "utmSource" | "utmMedium" | "utmCampaign" | "timeZone"
>;

const KEY = "request-attribution";

const emptyAttribution = (): Attribution => ({
  landingPath: "",
  referrer: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  timeZone: "",
});

// Pure, for tests: what to remember about this landing.
export const attributionFrom = (
  location: { pathname: string; search: string; origin: string },
  referrer: string,
): Omit<Attribution, "timeZone"> => {
  const params = new URLSearchParams(location.search);
  let externalReferrer = "";
  try {
    const url = new URL(referrer);
    if (url.origin !== location.origin) externalReferrer = `${url.origin}${url.pathname}`;
  } catch {
    // No referrer, or not a URL.
  }
  return {
    landingPath: location.pathname,
    referrer: externalReferrer,
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
  };
};

// Call once at startup. Keeps the first landing of the visit.
export const recordLanding = () => {
  try {
    if (window.sessionStorage.getItem(KEY)) return;
    // Staff pages and private shortlist links aren't visits to the site.
    if (/^\/(admin|shortlist)/.test(window.location.pathname)) return;
    const value = attributionFrom(window.location, document.referrer);
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode, settings): requests simply go without it.
  }
};

export const readAttribution = (): Attribution => {
  const result = emptyAttribution();
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}") as Partial<Attribution>;
    for (const key of Object.keys(result) as Array<keyof Attribution>) {
      if (typeof stored[key] === "string") result[key] = stored[key];
    }
  } catch {
    // Missing or unreadable: send nothing.
  }
  try {
    result.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    // Very old browsers.
  }
  return result;
};
