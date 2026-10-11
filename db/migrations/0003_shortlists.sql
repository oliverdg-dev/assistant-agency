-- Phase 4: candidate profiles, shortlists per request, and private links that
-- let a client review a shortlist without an account.
--
-- PLACEHOLDER POLICY (needs the owner and counsel before launch, gate G3):
-- a candidate is shown to a client only after staff record that the
-- candidate agreed to share their profile with that client, and every
-- profile has a delete_after date (default 12 months).

CREATE TABLE IF NOT EXISTS candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name        text NOT NULL,
  last_name         text NOT NULL,
  headline          text NOT NULL,
  years_experience  integer CHECK (years_experience BETWEEN 0 AND 60),
  skills            text,
  english_level     text,
  availability      text,
  monthly_rate_usd  integer CHECK (monthly_rate_usd BETWEEN 0 AND 100000),
  delete_after      date NOT NULL DEFAULT (current_date + 365),
  created_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidates_delete_after_idx ON candidates (delete_after);

-- A candidate on one request's shortlist. Published rows are what the client sees.
CREATE TABLE IF NOT EXISTS request_candidates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES booking_leads (id) ON DELETE CASCADE,
  candidate_id     uuid NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  rank             integer NOT NULL DEFAULT 0,
  why_picked       text,
  consent_at       timestamptz,
  consent_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  published_at     timestamptz,
  withdrawn_at     timestamptz,
  client_decision  text CHECK (client_decision IN ('interview', 'pass')),
  pass_reason      text,
  decided_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS request_candidates_request_idx ON request_candidates (request_id, rank);

-- Private links. Only a hash of the token is stored; the token travels in the
-- URL fragment. Sending a new link revokes the earlier ones for that request.
CREATE TABLE IF NOT EXISTS shortlist_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES booking_leads (id) ON DELETE CASCADE,
  token_hash       text NOT NULL UNIQUE,
  sent_to          text NOT NULL,
  respond_by       date NOT NULL,
  expires_at       timestamptz NOT NULL,
  revoked_at       timestamptz,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  view_count       integer NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortlist_links_request_idx ON shortlist_links (request_id, created_at);

-- What "Continue" on the link page exchanges the token for: a short-lived
-- httpOnly cookie that works for this one shortlist only.
CREATE TABLE IF NOT EXISTS shortlist_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     uuid NOT NULL REFERENCES shortlist_links (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- New timeline entries. The list must match REQUEST_EVENT_KINDS in
-- api/_lib/requestStatus.ts (a test checks this).
ALTER TABLE request_events DROP CONSTRAINT IF EXISTS request_events_kind_check;
ALTER TABLE request_events ADD CONSTRAINT request_events_kind_check
  CHECK (kind IN ('status_change', 'note', 'status_inquiry', 'discovery_call', 'link', 'owner_change',
                  'shortlist_published', 'shortlist_viewed', 'client_choices'));
