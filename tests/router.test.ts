import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND } from "../api/_lib/brand.ts";
import {
  descriptionFor,
  formLink,
  isNoindex,
  isPlainLeftClick,
  normalizePath,
  pageFromPath,
  pathForPage,
  ROUTES,
  titleFor,
} from "../src/lib/router.ts";

describe("route table", () => {
  it("maps every canonical path to its page and back", () => {
    for (const route of ROUTES.filter((r) => !r.path.includes(":"))) {
      assert.deepEqual(pageFromPath(route.path), { page: route.page, canonical: route.path });
      assert.equal(pathForPage(route.page), route.path);
    }
  });

  it("has unique paths and aliases", () => {
    const all = ROUTES.flatMap((route) => [route.path, ...route.aliases]);
    assert.equal(new Set(all).size, all.length);
  });

  it("canonicalises aliases", () => {
    assert.deepEqual(pageFromPath("/booking"), { page: "booking", canonical: "/get-started" });
    assert.deepEqual(pageFromPath("/roles"), { page: "services", canonical: "/services" });
  });

  it("normalises trailing slashes, case and doubled slashes", () => {
    assert.equal(normalizePath("/Services/"), "/services");
    assert.equal(normalizePath("//how-it-works"), "/how-it-works");
    assert.equal(normalizePath("/"), "/");
    assert.equal(pageFromPath("/GET-STARTED/").page, "booking");
  });

  it("sends unknown paths to not-found", () => {
    assert.equal(pageFromPath("/pricing").page, "not-found");
    assert.equal(pageFromPath("/services/extra").page, "not-found");
  });
});

describe("staff pages", () => {
  it("reads the request id from the path", () => {
    assert.deepEqual(pageFromPath("/admin/requests/0b5e8c1a-1234-4abc-8def-0123456789ab"), {
      page: "admin-request",
      canonical: "/admin/requests/0b5e8c1a-1234-4abc-8def-0123456789ab",
      params: { id: "0b5e8c1a-1234-4abc-8def-0123456789ab" },
    });
    assert.equal(pageFromPath("/admin/requests").page, "admin-requests");
    assert.equal(pageFromPath("/admin").page, "admin-sign-in");
    assert.equal(pageFromPath("/admin/requests/abc/extra").page, "not-found");
  });

  it("builds paths with the id and the rest as a query", () => {
    assert.equal(pathForPage("admin-request", { id: "abc" }), "/admin/requests/abc");
    assert.equal(pathForPage("admin-requests", { status: "all" }), "/admin/requests?status=all");
    assert.equal(pathForPage("admin-sign-in", { next: "/admin/requests/abc" }), "/admin/sign-in?next=%2Fadmin%2Frequests%2Fabc");
  });

  it("keeps staff pages out of search engines", () => {
    assert.equal(isNoindex("admin-request"), true);
    assert.equal(isNoindex("admin-sign-in"), true);
    assert.equal(isNoindex("home"), false);
  });
});

describe("links and params", () => {
  it("encodes query params", () => {
    assert.equal(
      pathForPage("booking", { role: "Accounts Payable / Receivable Specialist" }),
      "/get-started?role=Accounts+Payable+%2F+Receivable+Specialist",
    );
  });

  it("builds form deep links and drops empty values", () => {
    assert.equal(formLink({ role: "Bookkeeper" }), "/get-started?role=Bookkeeper");
    assert.equal(formLink({ headcount: "4-10", role: "" }), "/get-started?headcount=4-10");
    assert.equal(formLink(), "/get-started");
    const url = new URL(formLink({ category: "Sales & Lead Generation" }), "http://x");
    assert.equal(url.searchParams.get("category"), "Sales & Lead Generation");
  });
});

describe("document metadata", () => {
  it("titles every page with the brand", () => {
    for (const route of ROUTES) {
      assert.ok(titleFor({ page: route.page, search: "" }).includes(BRAND.name));
      assert.ok(descriptionFor(route.page).length > 20);
    }
    assert.equal(titleFor({ page: "not-found", search: "" }), `Page not found | ${BRAND.name}`);
  });

  it("includes the form step in the title", () => {
    assert.equal(titleFor({ page: "booking", search: "?step=2" }), `Step 2 of 3 · Get started | ${BRAND.name}`);
    assert.equal(titleFor({ page: "booking", search: "?step=9" }), `Tell us what you need | ${BRAND.name}`);
  });
});

describe("isPlainLeftClick", () => {
  const event = (overrides: Partial<Parameters<typeof isPlainLeftClick>[0]> = {}) => ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    currentTarget: { getAttribute: () => null },
    ...overrides,
  });

  it("handles a plain left click in-app", () => {
    assert.equal(isPlainLeftClick(event()), true);
  });

  it("leaves modified, middle and targeted clicks to the browser", () => {
    assert.equal(isPlainLeftClick(event({ metaKey: true })), false);
    assert.equal(isPlainLeftClick(event({ ctrlKey: true })), false);
    assert.equal(isPlainLeftClick(event({ shiftKey: true })), false);
    assert.equal(isPlainLeftClick(event({ button: 1 })), false);
    assert.equal(isPlainLeftClick(event({ defaultPrevented: true })), false);
    assert.equal(isPlainLeftClick(event({ currentTarget: { getAttribute: () => "_blank" } })), false);
  });
});
