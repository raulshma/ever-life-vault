-- Migration: Ensure views run with invoker rights (fixes linter 0010_security_definer_view)
-- Affects:
--   - public.system_settings_by_feature
--   - public.receipt_document_ai_analytics
--
-- Postgres 15+ supports security_invoker for views. This makes the view enforce
-- the permissions and RLS of the querying user instead of the view owner.

-- Set invoker rights for the settings aggregation view
ALTER VIEW public.system_settings_by_feature SET (security_invoker = true);

-- Set invoker rights for the AI analytics view
ALTER VIEW public.receipt_document_ai_analytics SET (security_invoker = true);
