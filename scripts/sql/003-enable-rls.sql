-- Lock the public tables away from Supabase's auto-generated REST/GraphQL API.
--
-- The app never uses that API: api-server connects straight to Postgres as the
-- table owner (DATABASE_URL), and table owners bypass RLS. So enabling RLS with
-- no policies denies the anon/authenticated API roles everything, while the app
-- keeps working exactly as before. Fixes the Supabase Security Advisor
-- "RLS Disabled in Public" and "Sensitive Columns Exposed" errors.

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimension_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_ai_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages      ENABLE ROW LEVEL SECURITY;

-- Belt and braces: the API roles have no business touching these tables at all.
REVOKE ALL ON public.users, public.sessions, public.dimension_scores,
  public.diagnostic_metrics, public.session_ai_usage FROM anon, authenticated;
