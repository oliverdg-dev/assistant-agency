-- Phase 2: every form field in its own column, a status on each request,
-- duplicate protection, where the request came from, and an event history.
-- Additive only: existing rows get status 'received' from the default and no
-- events. The composed `message` text is still written, so emails and old
-- queries keep working.

ALTER TABLE booking_leads
  ADD COLUMN IF NOT EXISTS headcount        text,
  ADD COLUMN IF NOT EXISTS engagement_type  text,
  ADD COLUMN IF NOT EXISTS start_timeframe  text,
  ADD COLUMN IF NOT EXISTS sector           text,
  ADD COLUMN IF NOT EXISTS website          text,
  ADD COLUMN IF NOT EXISTS country          text,
  ADD COLUMN IF NOT EXISTS submission_id    text,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS landing_path     text,
  ADD COLUMN IF NOT EXISTS referrer         text,
  ADD COLUMN IF NOT EXISTS utm_source       text,
  ADD COLUMN IF NOT EXISTS utm_medium       text,
  ADD COLUMN IF NOT EXISTS utm_campaign     text,
  ADD COLUMN IF NOT EXISTS client_time_zone text,
  -- Which submission took responsibility for emailing the team (a random
  -- token per attempt), when, and when that email was sent. Lets a retried
  -- submission notify exactly once.
  ADD COLUMN IF NOT EXISTS internal_notify_claim      uuid,
  ADD COLUMN IF NOT EXISTS internal_notify_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- Must match REQUEST_STATUSES in api/_lib/requestStatus.ts. Changing the list
-- means dropping and re-adding this named constraint in a new migration.
ALTER TABLE booking_leads
  ADD CONSTRAINT booking_leads_status_check CHECK (status IN (
    'received', 'clarifying', 'sourcing', 'shortlist_ready',
    'interviewing', 'filled', 'on_hold', 'closed'
  ));

-- Duplicate protection. Older rows have no submission id (NULLs never clash).
CREATE UNIQUE INDEX IF NOT EXISTS booking_leads_submission_id_key ON booking_leads (submission_id);
CREATE INDEX IF NOT EXISTS booking_leads_status_created_idx ON booking_leads (status, created_at);
CREATE INDEX IF NOT EXISTS booking_leads_email_idx ON booking_leads (lower(email));

CREATE TABLE IF NOT EXISTS request_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES booking_leads (id) ON DELETE CASCADE,
  actor_user_id  uuid,
  kind           text NOT NULL CHECK (kind IN ('status_change', 'note', 'status_inquiry', 'discovery_call', 'link')),
  from_status    text,
  to_status      text,
  body           text,
  visibility     text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'client')),
  email_status   text,
  email_sent_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_events_request_created_idx ON request_events (request_id, created_at);
