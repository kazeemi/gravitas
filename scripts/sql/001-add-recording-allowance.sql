-- Adds the per-user recording allowance.
--
-- Safe to run more than once: IF NOT EXISTS means a second run does nothing.
-- Purely additive — creates a new column, touches no existing data.
-- Existing users get the 1800 second (30 minute) default.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recording_seconds_allowance integer NOT NULL DEFAULT 1800;
