-- Phase 3: staff sign-in (emailed one-time codes), sessions, rate limits, and
-- an owner for each request. Staff are added with `npm run db:make-staff`
-- (locally) or by SQL on production; nobody can sign themselves up.

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  name        text,
  is_staff    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per code sent. Only a hash is stored; a code works once, for a
-- limited time and a limited number of tries.
CREATE TABLE IF NOT EXISTS sign_in_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sign_in_codes_user_idx ON sign_in_codes (user_id, created_at);

-- Only a hash of the session token is stored; the token itself lives in an
-- httpOnly cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    text NOT NULL UNIQUE,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Fixed-window counters (for example, sign-in codes per email per 15 minutes).
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE booking_leads
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

-- Timeline entries now name the staff member who made them, and owner changes
-- get their own kind. The list must match REQUEST_EVENT_KINDS in
-- api/_lib/requestStatus.ts (a test checks this).
ALTER TABLE request_events DROP CONSTRAINT IF EXISTS request_events_kind_check;
ALTER TABLE request_events ADD CONSTRAINT request_events_kind_check
  CHECK (kind IN ('status_change', 'note', 'status_inquiry', 'discovery_call', 'link', 'owner_change'));

ALTER TABLE request_events DROP CONSTRAINT IF EXISTS request_events_actor_user_id_fkey;
ALTER TABLE request_events ADD CONSTRAINT request_events_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS booking_leads_owner_idx ON booking_leads (owner_user_id);
