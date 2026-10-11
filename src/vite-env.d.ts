/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional https link to the team's booking calendar (Calendly, Cal.com…).
  readonly VITE_BOOKING_CALENDAR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
