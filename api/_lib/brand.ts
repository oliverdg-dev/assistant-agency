// The only place the business name and public contact addresses are set.
// Everything else (nav, footer, page titles, index.html, legal pages, emails)
// reads from here.
//
// These are placeholders. A production build on Vercel refuses to run until
// they are replaced (see vite.config.ts), unless ALLOW_PLACEHOLDER_BRAND=1.
export const BRAND = {
  name: "Your Agency",
  shortName: "Your Agency",
  contactEmail: "hello@example.com",
  privacyEmail: "privacy@example.com",
} as const;

export interface BrandInfo {
  name: string;
  shortName: string;
  contactEmail: string;
  privacyEmail: string;
}

export const isPlaceholderBrand = (brand: BrandInfo = BRAND): boolean =>
  brand.name === "Your Agency" ||
  brand.shortName === "Your Agency" ||
  brand.contactEmail.endsWith("example.com") ||
  brand.privacyEmail.endsWith("example.com");
