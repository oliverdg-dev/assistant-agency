import { BRAND } from "../../api/_lib/brand.js";
import { Link } from "./Link";
import { Container } from "./ui";
import type { Page } from "../lib/router";

const COLUMNS: Array<{ title: string; links: Array<{ page: Page; label: string }> }> = [
  {
    title: "Explore",
    links: [
      { page: "services", label: "Roles we place" },
      { page: "how-it-works", label: "How it works" },
      { page: "case-studies", label: "Case studies" },
    ],
  },
  {
    title: "Legal",
    links: [
      { page: "privacy", label: "Privacy Policy" },
      { page: "terms", label: "Terms of Service" },
      { page: "cookies", label: "Cookie Policy" },
    ],
  },
];

const linkClass = "text-[0.9375rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <Container className="grid gap-10 py-12 md:grid-cols-12 md:py-16">
        <div className="md:col-span-5">
          <Link to="home" className="font-serif text-xl font-semibold text-ink">
            {BRAND.name}
          </Link>
          <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-muted">
            Skilled professionals from the Philippines for North American teams.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="md:col-span-2">
            <h2 className="font-sans text-sm font-semibold text-ink">{column.title}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.page}>
                  <Link to={link.page} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="md:col-span-3">
          <h2 className="font-sans text-sm font-semibold text-ink">Get started</h2>
          <ul className="mt-4 space-y-3">
            <li>
              <Link to="booking" className={linkClass}>
                Tell us what you need
              </Link>
            </li>
            <li>
              <a href={`mailto:${BRAND.contactEmail}`} className={linkClass}>
                {BRAND.contactEmail}
              </a>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="py-6 text-sm text-ink-subtle">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </Container>
      </div>
    </footer>
  );
}
