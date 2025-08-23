-- Migration: Remove SECURITY DEFINER from views system_settings_by_feature and receipt_document_ai_analytics
-- Fixes security linter errors for views defined with SECURITY DEFINER

-- Recreate system_settings_by_feature view without SECURITY DEFINER
DROP VIEW IF EXISTS public.system_settings_by_feature;
CREATE OR REPLACE VIEW public.system_settings_by_feature AS
SELECT 
  user_id,
  feature_category,
  jsonb_object_agg(setting_key, setting_value) AS settings
FROM public.system_settings
GROUP BY user_id, feature_category;

COMMENT ON VIEW public.system_settings_by_feature IS 'Aggregated view of settings grouped by user and feature category';
GRANT SELECT ON public.system_settings_by_feature TO authenticated;

-- Recreate receipt_document_ai_analytics view without SECURITY DEFINER
DROP VIEW IF EXISTS public.receipt_document_ai_analytics;
CREATE OR REPLACE VIEW public.receipt_document_ai_analytics AS
SELECT 
  rd.document_type,
  rd.analysis_status,
  rd.analysis_model_used,
  COUNT(*) as document_count,
  AVG(rd.ai_confidence_score) as avg_confidence_score,
  AVG(rd.analysis_duration_ms) as avg_analysis_duration_ms,
  MIN(rd.created_at) as first_analysis_date,
  MAX(rd.updated_at) as latest_analysis_date
FROM public.receipt_documents rd
WHERE rd.ai_analysis_data IS NOT NULL
GROUP BY rd.document_type, rd.analysis_status, rd.analysis_model_used
ORDER BY document_count DESC;

COMMENT ON VIEW public.receipt_document_ai_analytics IS 'Analytics view for receipt document AI analysis performance and usage metrics';
GRANT SELECT ON public.receipt_document_ai_analytics TO authenticated;
GRANT ALL ON public.receipt_document_ai_analytics TO service_role;
