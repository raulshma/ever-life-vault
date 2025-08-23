-- Migration: Fix function search_path to satisfy security linter (0011_function_search_path_mutable)
-- This migration redefines functions with an explicit search_path to avoid role-mutable search paths.
-- Created: 2025-08-24 18:00:00

-- 1) public.update_updated_at()
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

COMMENT ON FUNCTION public.update_updated_at() IS 'Updates updated_at column to now(); search_path pinned to public.';

-- 2) public.update_system_settings_updated_at()
CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

COMMENT ON FUNCTION public.update_system_settings_updated_at() IS 'Updates system_settings.updated_at to NOW(); search_path pinned to public.';

-- 3) public.cleanup_old_llm_cache(days_to_keep integer DEFAULT 30)
CREATE OR REPLACE FUNCTION public.cleanup_old_llm_cache(
  days_to_keep integer DEFAULT 30
) RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.llm_models_cache 
  WHERE updated_at < now() - interval '1 day' * days_to_keep;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION public.cleanup_old_llm_cache(integer) IS 'Clean up old LLM cache entries; search_path pinned to public.';

-- 4) public.ensure_single_primary_document()
CREATE OR REPLACE FUNCTION public.ensure_single_primary_document()
RETURNS trigger AS $$
BEGIN
  -- If setting this document as primary, unset all other primary documents for this receipt
  IF NEW.is_primary = true THEN
    UPDATE public.receipt_documents
    SET is_primary = false
    WHERE receipt_id = NEW.receipt_id 
      AND id != NEW.id 
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

COMMENT ON FUNCTION public.ensure_single_primary_document() IS 'Trigger helper to enforce single primary document per receipt; search_path pinned to public.';

-- 5) public.log_document_analysis_completion()
CREATE OR REPLACE FUNCTION public.log_document_analysis_completion()
RETURNS trigger AS $$
BEGIN
  -- Log successful analysis completion for metrics
  IF NEW.analysis_status = 'completed' AND OLD.analysis_status != 'completed' THEN
    RAISE NOTICE 'Document analysis completed for document % with confidence %', NEW.id, NEW.ai_confidence_score;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SET search_path = public;

COMMENT ON FUNCTION public.log_document_analysis_completion() IS 'Logs completion of AI analysis via NOTICE; search_path pinned to public.';
