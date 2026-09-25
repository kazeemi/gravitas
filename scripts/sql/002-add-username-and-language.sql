-- Adds a username login handle (for accounts without a real email, e.g.
-- client-provided candidate accounts) and a language flag that drives both
-- transcription language and feedback-writing language.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language varchar(5) NOT NULL DEFAULT 'en';
