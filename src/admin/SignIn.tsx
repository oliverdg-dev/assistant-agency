import { useEffect, useRef, useState, type FormEvent } from "react";
import { BRAND } from "../../api/_lib/brand.js";
import { Button, controlClass, Field } from "../components/ui";
import { navigate, pageFromPath } from "../lib/router";
import { adminApi, type StaffUser } from "./api";

// Only same-site staff pages are allowed as the place to return to.
const safeNext = (next: string | null) => {
  if (!next || !next.startsWith("/admin/") || next.startsWith("//")) return null;
  const url = new URL(next, window.location.origin);
  const { page, params } = pageFromPath(url.pathname);
  return page === "admin-requests" || page === "admin-request" ? { page, params, search: url.search } : null;
};

export default function SignInPage({ next, onSignedIn }: { next: string | null; onSignedIn: (user: StaffUser) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const result = await adminApi<{ message: string }>("/auth/request-code", { method: "POST", body: { email } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setMessage(result.data.message);
    setCode("");
    setStep("code");
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await adminApi<{ user: StaffUser }>("/auth/verify", { method: "POST", body: { email, code } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onSignedIn(result.data.user);
    const target = safeNext(next);
    if (target) {
      const query = Object.fromEntries(new URLSearchParams(target.search));
      navigate(target.page, { ...target.params, ...query }, { replace: true });
    } else {
      navigate("admin-requests", undefined, { replace: true });
    }
  };

  return (
    <main id="main" className="flex min-h-screen items-start justify-center bg-surface px-4 pt-[12vh]">
      <div className="w-full max-w-sm">
        <p className="font-serif text-lg font-semibold text-ink">{BRAND.shortName}</p>
        <h1 className="mt-6 text-3xl">Staff sign-in</h1>

        {step === "email" ? (
          <form className="mt-6 space-y-5" onSubmit={requestCode} noValidate>
            <p className="text-ink-muted">Enter your work email. We'll send you a 6-digit code.</p>
            <Field id="staff-email" label="Work email" error={error ?? undefined}>
              <input
                id="staff-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={controlClass(Boolean(error))}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-email-error" : undefined}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={verify} noValidate>
            <p className="text-ink-muted" role="status">
              {message}
            </p>
            <Field id="staff-code" label="6-digit code" hint={`Sent to ${email.trim()}`} error={error ?? undefined}>
              <input
                ref={codeInput}
                id="staff-code"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                className={controlClass(Boolean(error), "text-center text-2xl tracking-[0.4em]")}
                aria-invalid={Boolean(error)}
                aria-describedby={["staff-code-hint", error ? "staff-code-error" : ""].filter(Boolean).join(" ")}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || code.replace(/\s/g, "").length !== 6}>
              {busy ? "Checking…" : "Continue"}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="font-semibold text-brand hover:underline"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                Use a different email
              </button>
              <button type="button" className="font-semibold text-brand hover:underline" disabled={busy} onClick={() => requestCode()}>
                Send a new code
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
