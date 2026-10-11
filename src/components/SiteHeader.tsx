import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { BRAND } from "../../api/_lib/brand.js";
import { Link } from "./Link";
import { ButtonLink, Container } from "./ui";
import type { Page } from "../lib/router";

const NAV: Array<{ page: Page; label: string }> = [
  { page: "services", label: "Roles" },
  { page: "how-it-works", label: "How it works" },
  { page: "case-studies", label: "Case studies" },
];

export function SiteHeader({ currentPage }: { currentPage: Page }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Close the mobile menu whenever the page changes.
  useEffect(() => setOpen(false), [currentPage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link to="home" className="whitespace-nowrap font-serif text-xl font-semibold text-ink">
          {BRAND.name}
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => {
              const current = currentPage === item.page;
              return (
                <li key={item.page}>
                  <Link
                    to={item.page}
                    aria-current={current ? "page" : undefined}
                    className={`text-[0.9375rem] font-medium underline-offset-[6px] hover:text-ink hover:underline ${
                      current ? "text-ink underline decoration-2" : "text-ink-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink to="booking" size="sm">
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Tell us what you need</span>
          </ButtonLink>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface-2 md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </Container>

      <div id={panelId} hidden={!open} className="border-t border-line bg-paper md:hidden">
        <Container className="py-3">
          <nav aria-label="Main (mobile)">
            <ul>
              {NAV.map((item) => (
                <li key={item.page}>
                  <Link
                    to={item.page}
                    aria-current={currentPage === item.page ? "page" : undefined}
                    className="flex min-h-12 items-center border-b border-line text-base font-medium text-ink last:border-0 aria-[current=page]:text-brand"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ButtonLink to="booking" className="mb-2 mt-3 w-full">
            Tell us what you need
          </ButtonLink>
        </Container>
      </div>
    </header>
  );
}
