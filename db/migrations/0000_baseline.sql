-- Baseline: the job request table as the booking API has written it so far.
-- Idempotent, so it is a no-op on a database that already has the table.
-- Before running migrations on production, confirm the real column types
-- (docs/RUNBOOK.md, "Migrations"); request_events below assumes id is uuid.

CREATE TABLE IF NOT EXISTS booking_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  email       text NOT NULL,
  company     text NOT NULL,
  role        text NOT NULL,
  budget      text NOT NULL,
  start_date  date,
  time_slot   text,
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
