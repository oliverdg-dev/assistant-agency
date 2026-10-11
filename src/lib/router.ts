import { useSyncExternalStore } from "react";
import { BRAND } from "../../api/_lib/brand.js";

/*
 * A small history-API router. Each page has one canonical path plus optional
 * aliases (old or alternative URLs that are rewritten to the canonical one).
 *
 *   click <Link> / navigate() ─┐
 *                              ├─▶ beforeLeave guard ─▶ pushState ─▶ notify ─▶ App re-renders
 *   browser back/forward ──────┘   (dirty form)          (or re-push on cancel)
 *
 * Query-only changes on the same page (form steps, deep-link params) are
 * "same-page": the guard is told, and App does not reset scroll or focus.
 * This module is the only writer of document.title and the meta description.
 */

export type Page =
  | "home"
  | "services"
  | "how-it-works"
  | "booking"
  | "case-studies"
  | "privacy"
  | "terms"
  | "cookies"
  | "shortlist"
  | "admin-sign-in"
  | "admin-requests"
  | "admin-request"
  | "not-found";

interface RouteDef {
  page: Exclude<Page, "not-found">;
  // May contain ":name" segments, filled from params (e.g. /admin/requests/:id).
  path: string;
  aliases: string[];
  label: string;
  title: string;
  description: string;
  // Staff pages: kept out of search engines.
  noindex?: boolean;
}

const TAGLINE = "Philippine talent for North American teams";

export const ROUTES: RouteDef[] = [
  // Homepage.
  {
    page: "home",
    path: "/",
    aliases: [],
    label: "Home",
    title: `${BRAND.name} | ${TAGLINE}`,
    description:
      "We find, vet and place skilled remote professionals from the Philippines with North American businesses.",
  },
  // Roles we place. Kept at /services for existing links; /roles also works.
  {
    page: "services",
    path: "/services",
    aliases: ["/roles"],
    label: "Roles",
    title: `Roles we place | ${BRAND.name}`,
    description:
      "Virtual assistants, customer support, sales, marketing, finance, creative, development and e-commerce roles.",
  },
  // How the hiring process works.
  {
    page: "how-it-works",
    path: "/how-it-works",
    aliases: [],
    label: "How it works",
    title: `How it works | ${BRAND.name}`,
    description:
      "Tell us the role, we source and vet candidates, and you meet a shortlist of professionals ready to start.",
  },
  // The job request form. /booking was its old URL.
  {
    page: "booking",
    path: "/get-started",
    aliases: ["/booking"],
    label: "Tell us what you need",
    title: `Tell us what you need | ${BRAND.name}`,
    description:
      "Describe the role you're hiring for. It takes about three minutes and there's no commitment.",
  },
  // Client case studies.
  {
    page: "case-studies",
    path: "/case-studies",
    aliases: [],
    label: "Case studies",
    title: `Case studies | ${BRAND.name}`,
    description: "How North American businesses have grown their teams with professionals from the Philippines.",
  },
  // Legal pages.
  { page: "privacy", path: "/privacy", aliases: [], label: "Privacy Policy", title: `Privacy Policy | ${BRAND.name}`, description: `How ${BRAND.name} collects, uses and protects your information.` },
  { page: "terms", path: "/terms", aliases: [], label: "Terms of Service", title: `Terms of Service | ${BRAND.name}`, description: `The terms that apply when you use ${BRAND.name}'s website and services.` },
  { page: "cookies", path: "/cookies", aliases: [], label: "Cookie Policy", title: `Cookie Policy | ${BRAND.name}`, description: `How ${BRAND.name} uses cookies on this website.` },
  // A client's shortlist, opened from a private link in an email (src/shortlist).
  { page: "shortlist", path: "/shortlist", aliases: [], label: "Your shortlist", title: `Your shortlist | ${BRAND.name}`, description: "Candidates picked for your role, from a private link.", noindex: true },
  // Staff area (src/admin). Not linked from the public site.
  { page: "admin-sign-in", path: "/admin/sign-in", aliases: ["/admin"], label: "Staff sign-in", title: `Staff sign-in | ${BRAND.name}`, description: "Sign in to the staff area with an emailed code.", noindex: true },
  { page: "admin-requests", path: "/admin/requests", aliases: [], label: "Requests", title: `Requests | Staff | ${BRAND.name}`, description: "Job requests from the website, for the team.", noindex: true },
  { page: "admin-request", path: "/admin/requests/:id", aliases: [], label: "Request", title: `Request | Staff | ${BRAND.name}`, description: "One job request and its timeline, for the team.", noindex: true },
];

const NOT_FOUND = {
  title: `Page not found | ${BRAND.name}`,
  description: "This page doesn't exist.",
};

export interface Route {
  page: Page;
  path: string;
  search: string;
  // Values of ":name" segments in the page's path.
  params: RouteParams;
}

export type RouteParams = Record<string, string>;

export const normalizePath = (pathname: string): string => {
  const lower = pathname.toLowerCase().replace(/\/{2,}/g, "/");
  return lower.length > 1 ? lower.replace(/\/+$/, "") : "/";
};

const matchPattern = (pattern: string, path: string): RouteParams | null => {
  if (!pattern.includes(":")) return null;
  const want = pattern.split("/");
  const got = path.split("/");
  if (want.length !== got.length) return null;
  const params: RouteParams = {};
  for (let i = 0; i < want.length; i += 1) {
    if (want[i].startsWith(":") && got[i]) {
      try {
        params[want[i].slice(1)] = decodeURIComponent(got[i]);
      } catch {
        return null;
      }
    } else if (want[i] !== got[i]) {
      return null;
    }
  }
  return params;
};

// Resolves a pathname to its page; `canonical` is the path it should show.
// `params` is present only for pages with ":name" segments.
export const pageFromPath = (pathname: string): { page: Page; canonical: string; params?: RouteParams } => {
  const path = normalizePath(pathname);
  const match = ROUTES.find((route) => route.path === path || route.aliases.includes(path));
  if (match) return { page: match.page, canonical: match.path };
  for (const route of ROUTES) {
    const params = matchPattern(route.path, path);
    if (params) return { page: route.page, canonical: path, params };
  }
  return { page: "not-found", canonical: path };
};

export const routeDef = (page: Page): RouteDef | undefined =>
  ROUTES.find((route) => route.page === page);

// Fills ":name" segments from params; the remaining params become the query.
export const pathForPage = (page: Page, params?: RouteParams): string => {
  const rest: RouteParams = { ...params };
  const base = (routeDef(page)?.path ?? "/").replace(/:([a-z]+)/gi, (_, name: string) => {
    const value = rest[name] ?? "";
    delete rest[name];
    return encodeURIComponent(value);
  });
  const query = new URLSearchParams(rest).toString();
  return query ? `${base}?${query}` : base;
};

// Deep link into the job request form. Values are matched exactly against the
// form's option lists when the form reads them.
export const formLink = (params: { role?: string; category?: string; headcount?: string } = {}) =>
  pathForPage(
    "booking",
    Object.fromEntries(Object.entries(params).filter(([, value]) => Boolean(value))) as RouteParams,
  );

export const titleFor = (route: Pick<Route, "page" | "search">): string => {
  if (route.page === "not-found") return NOT_FOUND.title;
  const def = routeDef(route.page);
  if (route.page === "booking") {
    const step = new URLSearchParams(route.search).get("step");
    if (step === "2" || step === "3") return `Step ${step} of 3 · Get started | ${BRAND.name}`;
  }
  return def?.title ?? `${BRAND.name}`;
};

export const descriptionFor = (page: Page): string =>
  page === "not-found" ? NOT_FOUND.description : routeDef(page)?.description ?? "";

export const isNoindex = (page: Page): boolean => Boolean(routeDef(page)?.noindex);

// ---------------------------------------------------------------------------
// Browser state. Everything below touches window and is only used in the app.
// ---------------------------------------------------------------------------

export type BeforeLeave = (next: Route, info: { samePage: boolean }) => boolean;

let current: Route | null = null;
let beforeLeave: BeforeLeave | null = null;
const listeners = new Set<() => void>();

const readLocation = (): Route => {
  const { page, canonical, params } = pageFromPath(window.location.pathname);
  return { page, path: canonical, search: window.location.search, params: params ?? {} };
};

const hrefOf = (route: Route) => `${route.path}${route.search}`;

const applyDocumentMeta = (route: Route) => {
  document.title = titleFor(route);
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", descriptionFor(route.page));
  let robots = document.querySelector('meta[name="robots"]');
  if (isNoindex(route.page)) {
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex");
  } else {
    robots?.remove();
  }
};

const commit = (next: Route) => {
  current = next;
  applyDocumentMeta(next);
  listeners.forEach((listener) => listener());
};

const ensureStarted = (): Route => {
  if (current) return current;

  const initial = readLocation();
  // Rewrite aliases and unnormalised paths (/booking, /Services/) to the
  // canonical URL without adding a history entry.
  if (initial.page !== "not-found" && window.location.pathname !== initial.path) {
    window.history.replaceState(window.history.state, "", hrefOf(initial));
  }
  current = initial;
  applyDocumentMeta(initial);

  window.addEventListener("popstate", () => {
    const previous = current!;
    const next = readLocation();
    const samePage = next.page === previous.page;
    if (beforeLeave && !beforeLeave(next, { samePage })) {
      // popstate can't be cancelled; put the page we're staying on back.
      window.history.pushState(null, "", hrefOf(previous));
      return;
    }
    commit(next);
  });

  return initial;
};

export const navigate = (
  page: Page,
  params?: RouteParams,
  options: { replace?: boolean } = {},
): void => {
  const previous = ensureStarted();
  const href = pathForPage(page, params);
  const url = new URL(href, window.location.origin);
  const next: Route = { page, path: url.pathname, search: url.search, params: pageFromPath(url.pathname).params ?? {} };
  const samePage = page === previous.page;

  if (beforeLeave && !beforeLeave(next, { samePage })) return;

  if (options.replace) {
    window.history.replaceState(null, "", href);
  } else if (hrefOf(previous) !== href) {
    window.history.pushState(null, "", href);
  }
  commit(next);
};

export const setBeforeLeave = (guard: BeforeLeave | null) => {
  beforeLeave = guard;
};

const subscribe = (listener: () => void) => {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useRoute = (): Route => useSyncExternalStore(subscribe, ensureStarted);

// For <a href> elements: navigate in-app only for a plain left click, so
// cmd/ctrl/shift-click and middle-click still open new tabs or windows.
export const isPlainLeftClick = (event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  currentTarget: { getAttribute(name: string): string | null };
}) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey &&
  !event.defaultPrevented &&
  !event.currentTarget.getAttribute("target");
