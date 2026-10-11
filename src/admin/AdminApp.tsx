import { useEffect, useState } from "react";
import { BRAND } from "../../api/_lib/brand.js";
import { Link } from "../components/Link";
import { Button } from "../components/ui";
import { navigate, type Route } from "../lib/router";
import { adminApi, type StaffUser } from "./api";
import InboxPage from "./Inbox";
import RequestPage from "./RequestDetail";
import SignInPage from "./SignIn";

/*
 * The staff area: its own shell, no marketing header or footer. Loaded only
 * when someone opens /admin/* (App.tsx lazy-loads this file).
 *
 *   /admin/sign-in ─▶ email ─▶ code ─▶ /admin/requests ─▶ /admin/requests/:id
 */

type Session = { state: "loading" } | { state: "signed-out" } | { state: "signed-in"; user: StaffUser };

export default function AdminApp({ route }: { route: Route }) {
  const [session, setSession] = useState<Session>({ state: "loading" });

  useEffect(() => {
    if (route.page === "admin-sign-in") return;
    let cancelled = false;
    adminApi<{ user: StaffUser }>("/me").then((result) => {
      if (cancelled) return;
      // A 401 already redirected to sign-in.
      setSession(result.ok ? { state: "signed-in", user: result.data.user } : { state: "signed-out" });
    });
    return () => {
      cancelled = true;
    };
  }, [route.page === "admin-sign-in"]);

  const signOut = async () => {
    await adminApi("/auth/sign-out", { method: "POST" });
    setSession({ state: "signed-out" });
    navigate("admin-sign-in", undefined, { replace: true });
  };

  if (route.page === "admin-sign-in") {
    return (
      <SignInPage
        next={new URLSearchParams(route.search).get("next")}
        onSignedIn={(user) => setSession({ state: "signed-in", user })}
      />
    );
  }

  if (session.state !== "signed-in") {
    return (
      <main id="main" className="flex min-h-screen items-center justify-center bg-surface text-ink-muted">
        <p role="status">{session.state === "loading" ? "Loading…" : "Signed out."}</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="admin-requests" className="whitespace-nowrap font-serif text-lg font-semibold text-ink">
              {BRAND.shortName} <span className="font-sans text-sm font-medium text-ink-muted">Staff</span>
            </Link>
            <nav aria-label="Staff">
              <Link
                to="admin-requests"
                aria-current={route.page === "admin-requests" ? "page" : undefined}
                className="text-sm font-semibold text-ink-muted hover:text-ink aria-[current=page]:text-ink"
              >
                Requests
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{session.user.name ?? session.user.email}</span>
            <Button variant="secondary" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {route.page === "admin-request" ? (
          <RequestPage id={route.params.id ?? ""} user={session.user} />
        ) : (
          <InboxPage search={route.search} />
        )}
      </main>
    </div>
  );
}
